import { supabase } from '../../lib/supabaseClient.js';

export async function getMyActiveLoans() {
  const { data, error } = await supabase.rpc('get_member_active_loans');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function requestLoanReturn(loanId) {
  const { data, error } = await supabase.rpc('request_loan_return', {
    p_loan_id: loanId,
  });
  if (error) throw new Error(error.message);
  return data;
}
