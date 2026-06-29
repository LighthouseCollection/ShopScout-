/* =============================================================
   ShopScout — feedback page (Report Bug / Suggest Feature)
   Extracted from comparison.js as the first slice of the
   monolith-split refactor. Self-contained: depends only on
     - openDashboardInfoPage (provided by comparison.js)
     - SS.toast / SS.escAttr  (from utils.js)
     - chrome.runtime.getManifest
   Exposes two globals (openFeedbackPage, handleFeedbackAction)
   so the ribbon-command dispatcher in comparison.js can call them.
   ============================================================= */
(function initFeedbackModule(root) {
  const chrome = root.browser || root.chrome;

  /* The recipient email is the maintainer's contact — kept as a
     constant so a future deployment with a different maintainer
     can change it in one place. */
  const FEEDBACK_TO_EMAIL = 'FrRaphaelMaher@gmail.com';

  function openFeedbackPage(kind) {
    const SS = root.SS;
    const escAttr = SS && SS.escAttr ? SS.escAttr : (s) => String(s);
    const isBug = kind === 'bug';
    const title = isBug ? 'Report Bug' : 'Suggest Feature';
    const subject = isBug ? 'ShopScout bug report' : 'ShopScout feature suggestion';
    /* Version is appended to the OUTGOING email body by
       handleFeedbackAction so the maintainer knows which build the
       user is on — it is NOT shown in the form to keep things clean. */
    root.openDashboardInfoPage(title, isBug
        ? 'Describe what happened. We read every report.'
        : 'Tell us what ShopScout should do next.',
      `<form class="dashboard-form" id="feedbackForm">
        <label>To<input type="text" value="${escAttr(FEEDBACK_TO_EMAIL)}" readonly></label>
        <label>Subject<input type="text" id="feedbackSubject" value="${escAttr(subject)}"></label>
        <label>Your email <span class="dashboard-form-optional">(optional — only if you want a reply)</span><input type="email" id="feedbackFromEmail" placeholder="you@example.com" autocomplete="email"></label>
        <label>Details<textarea id="feedbackDetails" rows="8" placeholder="${isBug ? 'What happened? What did you expect? Steps to reproduce.' : 'What should ShopScout do? How would you use it?'}"></textarea></label>
        <div class="dashboard-page-actions">
          <button class="btn primary" type="button" data-feedback-action="send">Send</button>
        </div>
      </form>`);
  }

  async function handleFeedbackAction(action) {
    if (action !== 'send') return;
    const SS = root.SS;
    const toast = (SS && SS.toast) || { show() {} };
    const subject = document.getElementById('feedbackSubject')?.value || 'ShopScout feedback';
    const details = document.getElementById('feedbackDetails')?.value || '';
    const fromEmail = (document.getElementById('feedbackFromEmail')?.value || '').trim();
    if (!details.trim()) { toast.show('Add some details first', 'error'); return; }
    const version = chrome.runtime.getManifest?.().version || 'unknown';
    /* Append context (reply-to + version) to the bottom of the body
       so the maintainer can act on the report without losing it in
       the user-visible form. */
    const meta = [
      fromEmail ? `Reply-to: ${fromEmail}` : '',
      `ShopScout version: ${version}`
    ].filter(Boolean).join('\n');
    const body = `${details.trim()}\n\n---\n${meta}\n`;
    const mailto = `mailto:${FEEDBACK_TO_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
    toast.show('Opening your email client…');
  }

  root.openFeedbackPage = openFeedbackPage;
  root.handleFeedbackAction = handleFeedbackAction;
})(globalThis);
