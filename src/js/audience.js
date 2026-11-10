import { supabase } from './supabase.js';
import { bindNavigation, escapeHtml, showAlert } from './ui.js';

await bindNavigation();
const code = new URLSearchParams(location.search).get('code')?.trim().toUpperCase();
const host = document.querySelector('#audience-room');
const tokenKey = 'pollpulse-live-guest-token';
const guestToken = localStorage.getItem(tokenKey) || crypto.randomUUID();
localStorage.setItem(tokenKey, guestToken);
let session;
let renderedSlideId;

async function loadSession() {
  if (!supabase || !code) { host.innerHTML = '<div class="alert alert-warning">Use the link or room code shared by your host.</div>'; return; }
  const { data, error } = await supabase.from('polls').select('id, title, join_code, active_slide_id, session_slides(*, session_options(*))').eq('join_code', code).single();
  if (error || !data?.active_slide_id) { host.innerHTML = '<div class="alert alert-danger">This live session is not available yet.</div>'; return; }
  session = data;
  const slide = session.session_slides.find(item => item.id === session.active_slide_id);
  if (!slide || slide.id === renderedSlideId) return;
  renderedSlideId = slide.id;
  render(slide);
}

function render(slide) {
  const options = slide.session_options.sort((a, b) => a.position - b.position);
  const content = slide.kind === 'info' ? '<p class="lead text-secondary">Follow along with your host. The next question will appear here automatically.</p>' : slide.question_type === 'open_text' ? '<textarea class="form-control" id="text-response" rows="5" maxlength="500" placeholder="Write your response…" required></textarea>' : `<div class="vstack gap-2">${options.map(option => `<label class="audience-option"><input class="form-check-input" type="radio" name="option" value="${option.id}" required><span>${escapeHtml(option.label)}</span></label>`).join('')}</div>`;
  host.innerHTML = `<p class="eyebrow text-center mb-2">YOU ARE IN · ${escapeHtml(session.title)}</p><section class="card border-0 shadow-sm p-4 p-md-5"><p class="text-secondary small mb-2">${slide.kind === 'info' ? 'LIVE UPDATE' : 'YOUR TURN'}</p><h1 class="h2 mb-4">${escapeHtml(slide.title)}</h1>${slide.kind === 'question' ? `<form id="response-form">${content}<button class="btn btn-primary w-100 mt-4">Send response</button></form>` : content}</section><section class="reaction-pad text-center mt-3"><p class="small text-secondary mb-2">React live</p><div>${['👏', '🔥', '💡', '😮', '❤️'].map(emoji => `<button class="reaction-button" type="button" data-emoji="${emoji}" aria-label="Send ${emoji} reaction">${emoji}</button>`).join('')}</div></section><section class="card border-0 shadow-sm mt-3 p-4"><p class="eyebrow mb-1">ASK THE HOST</p><h2 class="h5">Have a question?</h2><form id="question-form"><textarea class="form-control" name="question" rows="2" maxlength="300" minlength="3" placeholder="Type your question…" required></textarea><button class="btn btn-outline-primary btn-sm mt-2">Send question</button></form></section><p class="text-secondary small text-center mt-3">No account or app needed. One response per question.</p>`;
  document.querySelector('#response-form')?.addEventListener('submit', event => submitResponse(event, slide));
  document.querySelectorAll('[data-emoji]').forEach(button => button.addEventListener('click', () => sendReaction(button)));
  document.querySelector('#question-form').addEventListener('submit', sendQuestion);
}

async function submitResponse(event, slide) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const values = { poll_id: session.id, slide_id: slide.id, guest_token: guestToken };
  if (slide.question_type === 'open_text') values.text_answer = form.get('text-response')?.trim();
  else values.option_id = form.get('option');
  const { error } = await supabase.from('session_responses').insert(values);
  if (error) return showAlert(error.code === '23505' ? 'Your response to this question is already recorded.' : error.message, 'danger');
  event.currentTarget.innerHTML = '<div class="audience-sent text-center"><span>✓</span><h2 class="h4 mt-3">Response received</h2><p class="text-secondary mb-0">Watch for the next question on this page.</p></div>';
}

async function sendReaction(button) {
  button.classList.add('is-sent');
  const { error } = await supabase.from('audience_reactions').insert({ poll_id: session.id, guest_token: guestToken, emoji: button.dataset.emoji });
  if (error) showAlert(error.message, 'danger');
  setTimeout(() => button.classList.remove('is-sent'), 650);
}

async function sendQuestion(event) {
  event.preventDefault();
  const input = event.currentTarget.elements.question;
  const { error } = await supabase.from('audience_questions').insert({ poll_id: session.id, guest_token: guestToken, body: input.value.trim() });
  if (error) return showAlert(error.message, 'danger');
  input.value = '';
  showAlert('Question sent to the host for moderation.', 'success');
}

await loadSession();
setInterval(loadSession, 3000);
