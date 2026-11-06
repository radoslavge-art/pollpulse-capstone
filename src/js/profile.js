import { supabase } from './supabase.js';
import { bindNavigation, pollCard, requireUser, showAlert } from './ui.js';

await bindNavigation(); const user = await requireUser(); if (!user) throw new Error('Sign-in required');
const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
document.querySelector('#name').value = profile?.display_name || '';
document.querySelector('#avatar-preview').src = profile?.avatar_url || 'https://placehold.co/88x88/e0e7ff/1e3a8a?text=You';
document.querySelector('#avatar').addEventListener('change', event => { const file = event.target.files[0]; if (file) document.querySelector('#avatar-preview').src = URL.createObjectURL(file); });
document.querySelector('#profile-form').addEventListener('submit', async event => { event.preventDefault(); let avatarUrl = profile?.avatar_url || null; const file = document.querySelector('#avatar').files[0]; if (file) { const path = `${user.id}/${crypto.randomUUID()}-${file.name}`; const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: false }); if (error) return showAlert(error.message, 'danger'); avatarUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl; } const { error } = await supabase.from('profiles').update({ display_name: document.querySelector('#name').value.trim(), avatar_url: avatarUrl }).eq('id', user.id); if (error) showAlert(error.message, 'danger'); else showAlert('Profile saved.', 'success'); });
const { data: polls } = await supabase.from('polls').select('*, profiles(display_name), poll_options(id, text, vote_count)').eq('owner_id', user.id).order('created_at', { ascending: false });
document.querySelector('#my-polls').innerHTML = polls?.map(poll => `<div class="col">${pollCard(poll)}</div>`).join('') || '<p class="text-secondary">You have not created a poll yet.</p>';
