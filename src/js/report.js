import { supabase, currentUser } from './supabase.js';
import { bindNavigation, escapeHtml } from './ui.js';

await bindNavigation();
const id = new URLSearchParams(location.search).get('id');
const host = document.querySelector('#report');
const viewer = await currentUser();
if (!supabase || !id) host.innerHTML = '<div class="alert alert-warning">Open this report from a live session.</div>';
else {
  const { data: session, error } = await supabase.from('polls').select('id, title, owner_id, join_code, session_slides(id, title, position)').eq('id', id).single();
  if (error || viewer?.id !== session?.owner_id) host.innerHTML = '<div class="alert alert-danger">Only the session host can view this report.</div>';
  else {
    const [responsesResult, reactionsResult, questionsResult] = await Promise.all([
      supabase.from('session_responses').select('guest_token, created_at, text_answer, session_slides(title), session_options(label, is_correct)').eq('poll_id', id).order('created_at'),
      supabase.from('audience_reactions').select('emoji').eq('poll_id', id),
      supabase.from('audience_questions').select('body, approved').eq('poll_id', id)
    ]);
    const responses = responsesResult.data || [];
    const reactions = reactionsResult.data || [];
    const questions = questionsResult.data || [];
    const attendees = new Set(responses.map(item => item.guest_token)).size;
    const reactionCounts = reactions.reduce((counts, item) => ({ ...counts, [item.emoji]: (counts[item.emoji] || 0) + 1 }), {});
    host.innerHTML = `<div class="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4"><div><p class="eyebrow mb-1">SESSION REPORT</p><h1>${escapeHtml(session.title)}</h1><p class="text-secondary mb-0">Room code: <strong class="letter-code">${escapeHtml(session.join_code)}</strong></p></div><div class="d-flex gap-2"><a class="btn btn-outline-primary" href="present.html?id=${encodeURIComponent(id)}">Presenter</a><button id="download-csv" class="btn btn-primary">Download CSV</button></div></div><div class="row g-3 mb-4"><div class="col-md-4"><div class="metric-card"><strong>${attendees}</strong><span>unique participants</span></div></div><div class="col-md-4"><div class="metric-card"><strong>${responses.length}</strong><span>responses collected</span></div></div><div class="col-md-4"><div class="metric-card"><strong>${questions.length}</strong><span>audience questions</span></div></div></div><section class="card border-0 shadow-sm p-4 mb-4"><p class="eyebrow mb-1">REACTION SUMMARY</p><div class="reaction-summary">${Object.entries(reactionCounts).map(([emoji, count]) => `<span>${emoji} <b>${count}</b></span>`).join('') || '<span class="text-secondary">No reactions recorded.</span>'}</div></section><section class="card border-0 shadow-sm p-4"><p class="eyebrow mb-1">RESPONSE HISTORY</p><div class="table-responsive"><table class="table align-middle mb-0"><thead><tr><th>Slide</th><th>Response</th><th>Correct</th><th>Time</th></tr></thead><tbody>${responses.map(item => `<tr><td>${escapeHtml(item.session_slides?.title || 'Question')}</td><td>${escapeHtml(item.session_options?.label || item.text_answer || '—')}</td><td>${item.session_options ? (item.session_options.is_correct ? 'Yes' : 'No') : '—'}</td><td>${new Date(item.created_at).toLocaleString()}</td></tr>`).join('') || '<tr><td colspan="4" class="text-secondary">No responses yet.</td></tr>'}</tbody></table></div></section>`;
    document.querySelector('#download-csv').addEventListener('click', () => downloadCsv(session, responses, questions));
  }
}

function csvCell(value) { return `"${String(value ?? '').replaceAll('"', '""')}"`; }
function downloadCsv(session, responses, questions) {
  const rows = [['Session', session.title], [], ['Responses'], ['Slide', 'Answer', 'Correct', 'Guest token', 'Submitted at'], ...responses.map(item => [item.session_slides?.title, item.session_options?.label || item.text_answer, item.session_options?.is_correct ? 'Yes' : 'No', item.guest_token, item.created_at]), [], ['Questions'], ['Question', 'Approved'], ...questions.map(item => [item.body, item.approved ? 'Yes' : 'No'])];
  const blob = new Blob([rows.map(row => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${session.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'pollpulse-session'}-report.csv`; link.click(); URL.revokeObjectURL(link.href);
}
