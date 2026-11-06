import { supabase } from './supabase.js';
import { bindNavigation, requireUser, showAlert } from './ui.js';

await bindNavigation();
const options = document.querySelector('#options');
document.querySelector('#add-option').addEventListener('click', () => {
  if (options.querySelectorAll('input').length >= 6) return showAlert('A poll can have up to six options.', 'warning');
  const input = document.createElement('input'); input.className = 'form-control mb-2'; input.name = 'option'; input.placeholder = `Option ${options.querySelectorAll('input').length + 1}`; input.required = true; options.append(input);
});
document.querySelector('#poll-form').addEventListener('submit', async event => {
  event.preventDefault(); const user = await requireUser(); if (!user) return;
  const values = [...options.querySelectorAll('input')].map(input => input.value.trim()).filter(Boolean);
  if (values.length < 2) return showAlert('Add at least two options.', 'warning');
  const { data: poll, error } = await supabase.from('polls').insert({ owner_id: user.id, title: document.querySelector('#title').value.trim(), description: document.querySelector('#description').value.trim(), category: document.querySelector('#category').value }).select().single();
  if (error) return showAlert(error.message, 'danger');
  const { error: optionsError } = await supabase.from('poll_options').insert(values.map((text, position) => ({ poll_id: poll.id, text, position })));
  if (optionsError) return showAlert(optionsError.message, 'danger');
  location.href = `poll.html?id=${poll.id}`;
});
