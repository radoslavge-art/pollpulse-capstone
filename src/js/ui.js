import { supabase, isConfigured, currentUser, profileFor } from './supabase.js';

export const demoPolls = [
  { id: 'demo-1', title: 'Where should our next team offsite be?', description: 'Vote for the city you would most like to visit.', category: 'Work', created_at: '2026-11-03', profiles: { display_name: 'Maya Chen' }, poll_options: [{ id: 'a', text: 'Sofia', vote_count: 18 }, { id: 'b', text: 'Plovdiv', vote_count: 14 }, { id: 'c', text: 'Varna', vote_count: 9 }] },
  { id: 'demo-2', title: 'Which workshop would you attend?', description: 'Help plan the next learning session.', category: 'Learning', created_at: '2026-11-02', profiles: { display_name: 'Alex Rivera' }, poll_options: [{ id: 'd', text: 'AI prompting', vote_count: 22 }, { id: 'e', text: 'Web accessibility', vote_count: 16 }] }
];

export const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));

export function showAlert(message, type = 'info') {
  const host = document.querySelector('#alert-host');
  if (host) host.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show" role="alert">${escapeHtml(message)}<button class="btn-close" data-bs-dismiss="alert"></button></div>`;
}

export function pollCard(poll) {
  const total = poll.poll_options?.reduce((sum, option) => sum + (option.vote_count || 0), 0) || 0;
  return `<article class="card h-100 poll-card shadow-sm border-0"><div class="card-body d-flex flex-column"><div class="d-flex justify-content-between gap-3"><span class="badge text-bg-light">${escapeHtml(poll.category || 'General')}</span><small class="text-secondary">${total} votes</small></div><h2 class="h5 mt-3">${escapeHtml(poll.title)}</h2><p class="text-secondary flex-grow-1">${escapeHtml(poll.description || 'No description provided.')}</p><div class="d-flex justify-content-between align-items-center"><small>by ${escapeHtml(poll.profiles?.display_name || 'PollPulse member')}</small><a class="btn btn-sm btn-primary" href="poll.html?id=${encodeURIComponent(poll.id)}">View poll</a></div></div></article>`;
}

export async function getPolls() {
  if (!supabase) return demoPolls;
  const { data, error } = await supabase.from('polls').select('*, profiles(display_name), poll_options(id, text, vote_count)').eq('is_published', true).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function bindNavigation() {
  const authArea = document.querySelector('#auth-area');
  if (!authArea) return;
  const user = await currentUser();
  if (!user) { authArea.innerHTML = '<a class="btn btn-outline-primary btn-sm" href="login.html">Log in</a><a class="btn btn-primary btn-sm ms-2" href="register.html">Join free</a>'; return; }
  const profile = await profileFor(user.id);
  authArea.innerHTML = `<a class="btn btn-outline-primary btn-sm" href="profile.html">${escapeHtml(profile?.display_name || 'Profile')}</a><button class="btn btn-primary btn-sm ms-2" id="sign-out">Log out</button>`;
  document.querySelector('#sign-out')?.addEventListener('click', async () => { await supabase.auth.signOut(); location.href = 'index.html'; });
}

export async function requireUser() {
  if (!isConfigured) { showAlert('Demo mode is active. Add Supabase values to .env to enable this action.', 'warning'); return null; }
  const user = await currentUser();
  if (!user) { location.href = 'login.html'; return null; }
  return user;
}
