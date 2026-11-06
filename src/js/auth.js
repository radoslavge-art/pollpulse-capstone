import { supabase, isConfigured } from './supabase.js';
import { showAlert } from './ui.js';

const form = document.querySelector('form');
form?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!isConfigured) return showAlert('Add your Supabase URL and publishable key to .env first.', 'warning');
  const email = document.querySelector('#email').value.trim();
  const password = document.querySelector('#password').value;
  const isRegister = form.id === 'register-form';
  const request = isRegister
    ? supabase.auth.signUp({ email, password, options: { data: { display_name: document.querySelector('#name').value.trim() } } })
    : supabase.auth.signInWithPassword({ email, password });
  const { error } = await request;
  if (error) return showAlert(error.message, 'danger');
  if (isRegister) showAlert('Check your inbox to confirm your account, then log in.', 'success');
  else location.href = 'index.html';
});
