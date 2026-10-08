// The single notice region and the confirm dialog.

const region = () => document.getElementById('notice');

// Shows one notice, replacing any other. action: { label, onClick } or null.
export function showNotice(text, { error = false, action = null } = {}) {
  const el = region();
  el.replaceChildren();
  el.setAttribute('role', error ? 'alert' : 'status');
  el.classList.toggle('notice-error', error);

  const message = document.createElement('p');
  message.textContent = text;
  el.append(message);

  if (action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = action.label;
    button.addEventListener('click', () => {
      dismissNotice();
      action.onClick();
    });
    el.append(button);
  }

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.textContent = 'Dismiss';
  dismiss.addEventListener('click', dismissNotice);
  el.append(dismiss);
  el.hidden = false;
}

export function dismissNotice() {
  const el = region();
  el.hidden = true;
  el.replaceChildren();
}

// Resolves true when confirmed, false on Cancel or Escape.
export function confirmAction(message, confirmLabel) {
  const dialog = document.getElementById('confirm-dialog');
  dialog.querySelector('[data-role="message"]').textContent = message;
  const ok = dialog.querySelector('[data-role="ok"]');
  ok.textContent = confirmLabel;
  return new Promise((resolve) => {
    const onClose = () => {
      dialog.removeEventListener('close', onClose);
      resolve(dialog.returnValue === 'ok');
    };
    dialog.addEventListener('close', onClose);
    dialog.returnValue = '';
    dialog.showModal();
  });
}
