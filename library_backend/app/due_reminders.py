import logging
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr

import httpx

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)


def raise_for_rpc_error(response: httpx.Response, rpc_name: str) -> None:
    if response.is_success:
        return

    try:
        payload = response.json()
    except ValueError:
        payload = {}

    if isinstance(payload, dict):
        code = payload.get("code")
        message = payload.get("message")
        hint = payload.get("hint")
        diagnostic = "; ".join(
            f"{label}={value}"
            for label, value in (("code", code), ("message", message), ("hint", hint))
            if isinstance(value, str) and value
        )
    else:
        diagnostic = ""

    if not diagnostic:
        diagnostic = "Supabase returned no readable error message."
    raise RuntimeError(
        f"Supabase RPC {rpc_name} failed with HTTP {response.status_code}: {diagnostic}"
    )


def validate_settings(current: Settings) -> None:
    missing = []
    if not current.supabase_url:
        missing.append("SUPABASE_URL")
    if not current.supabase_service_role_key:
        missing.append("SUPABASE_SERVICE_ROLE_KEY")
    if not current.gmail_smtp_username:
        missing.append("GMAIL_SMTP_USERNAME")
    if not current.gmail_smtp_app_password:
        missing.append("GMAIL_SMTP_APP_PASSWORD")
    if missing:
        raise RuntimeError(f"Missing reminder configuration: {', '.join(missing)}")


def send_email(current: Settings, reminder: dict) -> None:
    kind = reminder["reminder_kind"]
    timing = "within the next 24 hours" if kind == "due_soon" else "within the next 48 hours"
    due_at = reminder["due_at"].replace("T", " ").replace("+00:00", " UTC").replace("Z", " UTC")
    message = EmailMessage()
    message["Subject"] = f"Library due-date reminder: {reminder['book_title']}"
    message["From"] = formataddr(("Library", current.gmail_smtp_username))
    message["To"] = reminder["recipient_email"]
    message.set_content(
        f"Hello {reminder['recipient_name']},\n\n"
        f"This is a reminder that “{reminder['book_title']}” is due {timing}.\n"
        f"Due date: {due_at}\n\n"
        "Please return or renew the item through your library. If you have already returned it, "
        "you can disregard this message.\n\n"
        "Library team"
    )

    context = ssl.create_default_context()
    with smtplib.SMTP_SSL(
        current.gmail_smtp_host,
        current.gmail_smtp_port,
        context=context,
        timeout=25,
    ) as client:
        client.login(current.gmail_smtp_username, current.gmail_smtp_app_password.replace(" ", ""))
        client.send_message(message)


def send_submission_email(current: Settings, notification: dict) -> None:
    approved = notification["status"] == "approved"
    decision = "approved and added to the library catalog" if approved else "not approved"
    message = EmailMessage()
    message["Subject"] = f"Journal submission update: {notification['title']}"
    message["From"] = formataddr(("Library", current.gmail_smtp_username))
    message["To"] = notification["recipient_email"]
    body = (
        f"Hello {notification['recipient_name']},\n\n"
        f"Your journal submission “{notification['title']}” was {decision}.\n"
    )
    if notification.get("reviewer_notes"):
        body += f"\nStaff note: {notification['reviewer_notes']}\n"
    body += "\nSign in to your library account to view your submission status.\n\nLibrary team"
    message.set_content(body)

    context = ssl.create_default_context()
    with smtplib.SMTP_SSL(
        current.gmail_smtp_host,
        current.gmail_smtp_port,
        context=context,
        timeout=25,
    ) as client:
        client.login(current.gmail_smtp_username, current.gmail_smtp_app_password.replace(" ", ""))
        client.send_message(message)


def process_notifications(client: httpx.Client, current: Settings, kind: str) -> tuple[int, int]:
    if kind == "due":
        claim_rpc = "claim_due_loan_reminders"
        complete_rpc = "complete_due_loan_reminder"
        send = send_email
        id_field = "reminder_id"
        error_field = "p_reminder_id"
    else:
        claim_rpc = "claim_journal_submission_emails"
        complete_rpc = "complete_journal_submission_email"
        send = send_submission_email
        id_field = "notification_id"
        error_field = "p_notification_id"

    base_url = current.supabase_url
    headers = {
        "apikey": current.supabase_service_role_key,
        "Authorization": f"Bearer {current.supabase_service_role_key}",
        "Content-Type": "application/json",
    }
    response = client.post(
        f"{base_url}/rest/v1/rpc/{claim_rpc}",
        headers=headers,
        json={},
    )
    raise_for_rpc_error(response, claim_rpc)
    notifications = response.json()
    if not isinstance(notifications, list):
        raise RuntimeError(f"Supabase returned an invalid {kind} notification response.")

    sent = 0
    failed = 0
    for notification in notifications:
        notification_id = notification.get(id_field)
        if not isinstance(notification_id, str):
            raise RuntimeError(f"Supabase returned a {kind} notification without an ID.")
        try:
            if not notification.get("recipient_email"):
                raise ValueError("The member account has no email address.")
            send(current, notification)
        except (OSError, ValueError, smtplib.SMTPException, ssl.SSLError) as error:
            failed += 1
            message = f"Email delivery failed ({type(error).__name__})."
            logger.warning("%s notification %s failed: %s", kind, notification_id, type(error).__name__)
            complete = client.post(
                f"{base_url}/rest/v1/rpc/{complete_rpc}",
                headers=headers,
                json={error_field: notification_id, "p_success": False, "p_error": message},
            )
            raise_for_rpc_error(complete, complete_rpc)
            continue

        complete = client.post(
            f"{base_url}/rest/v1/rpc/{complete_rpc}",
            headers=headers,
            json={error_field: notification_id, "p_success": True, "p_error": None},
        )
        raise_for_rpc_error(complete, complete_rpc)
        sent += 1
    return sent, failed


def run_due_reminders(current: Settings) -> dict[str, int]:
    validate_settings(current)
    with httpx.Client(timeout=20) as client:
        sent, failed = process_notifications(client, current, "due")
        submission_sent, submission_failed = process_notifications(client, current, "submission")
    logger.info(
        "Notification run complete: %s due reminders and %s submission updates sent; %s failed.",
        sent,
        submission_sent,
        failed + submission_failed,
    )
    return {
        "sent": sent,
        "failed": failed,
        "submission_sent": submission_sent,
        "submission_failed": submission_failed,
    }


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    result = run_due_reminders(get_settings())
    print(
        f"Due reminders: {result['sent']} sent, {result['failed']} failed. "
        f"Submission updates: {result['submission_sent']} sent, {result['submission_failed']} failed."
    )
    if result["failed"] or result["submission_failed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
