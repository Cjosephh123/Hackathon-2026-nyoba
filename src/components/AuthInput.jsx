import './AuthInput.css';

/** Icon + text field row used on auth pages. */
export default function AuthInput({ icon, label, id, ...inputProps }) {
  return (
    <div className="auth-input">
      <span className="auth-input__icon">{icon}</span>
      <label htmlFor={id} className="visually-hidden">
        {label}
      </label>
      <input id={id} className="auth-input__field" placeholder={label} {...inputProps} />
    </div>
  );
}
