import { supabase } from './supabase.js';
import { showAlert } from './ui.js';

const form = document.querySelector('#join-form');
const suppliedCode = new URLSearchParams(location.search).get('code');
if (suppliedCode) document.querySelector('#room-code').value = suppliedCode.toUpperCase();
form?.addEventListener('submit', async event => {
  event.preventDefault();
  const code = document.querySelector('#room-code').value.trim().toUpperCase();
  if (!supabase) return showAlert('Live rooms need the Supabase connection enabled.', 'warning');
  const { data, error } = await supabase.from('polls').select('id, is_published').eq('join_code', code).maybeSingle();
  if (error || !data || !data.is_published) return showAlert('We could not find an open room with that code.', 'warning');
  location.href = `poll.html?id=${encodeURIComponent(data.id)}`;
});
