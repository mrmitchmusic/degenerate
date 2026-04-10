const BREVO_FORM_URL =
  "https://0a026ca3.sibforms.com/serve/MUIFADeSGI6f9MdcaIxws8gsQIhKTdNbBFk31R6KC5u6VSSeksoqqttCBdD6F0dfuctR_kTZ-QvCMRucy1ILGwm7wf9HS-t8DF8fGsd214O7uIvqCuxF5JM9vqdNWscE2S0y2zpIvBdlOD-dWNRIqqFmSForYiPN_pTk6oiPh0UfgHgMyI7-CwkwSr_PvGsaG-fXlS6cMzVSgNMo";

export const dynamic = "force-dynamic";

const injectedStyle = `
  <style id="mitch-mailing-list-style">
    html, body {
      margin: 0;
      padding: 0;
      background: #c0c0c0 !important;
      color: #111 !important;
      font-family: Geneva, Arial, sans-serif !important;
      font-size: 12px !important;
      line-height: 1.4 !important;
    }

    body {
      min-height: 100vh;
      box-sizing: border-box;
      padding: 10px;
    }

    *, *::before, *::after {
      box-sizing: border-box;
      border-radius: 0 !important;
      box-shadow: none !important;
      font-family: Geneva, Arial, sans-serif !important;
    }

    img,
    .sib-form-block__image,
    .image-container,
    .header-banner,
    .sib-form-block--image {
      display: none !important;
    }

    #sib-container,
    .sib-container,
    .sib-form-container,
    .sib-form,
    form {
      max-width: none !important;
      width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      background: transparent !important;
      border: 0 !important;
    }

    .sib-form-block,
    .entry__field,
    .entry__specification,
    .form__entry,
    .sib-form-message-panel {
      background: transparent !important;
      border: 0 !important;
      padding: 0 !important;
      margin: 0 0 8px !important;
    }

    .mitch-mailing-list-copy {
      border: 1px solid #7b7b7b;
      background: #e0e0e0;
      box-shadow: inset 1px 1px 0 #ffffff, inset -1px -1px 0 #b9b9b9 !important;
      padding: 10px;
      margin-bottom: 10px;
    }

    .mitch-mailing-list-copy h1 {
      margin: 0 0 6px;
      font-size: 13px !important;
      font-weight: 700 !important;
    }

    .mitch-mailing-list-copy p {
      margin: 0;
    }

    label,
    .entry__label,
    .sib-form-block__label {
      display: block !important;
      margin: 0 0 4px !important;
      font-size: 12px !important;
      font-weight: 400 !important;
      color: #111 !important;
    }

    input[type="email"],
    input[type="text"],
    input[type="tel"],
    input[type="number"],
    textarea,
    select {
      width: 100% !important;
      min-height: 28px !important;
      padding: 4px 6px !important;
      background: #fff !important;
      border: 1px solid #000 !important;
      color: #111 !important;
      border-radius: 0 !important;
      outline: none !important;
      font-size: 12px !important;
    }

    button,
    input[type="submit"] {
      min-width: 110px !important;
      min-height: 28px !important;
      padding: 4px 12px !important;
      background: #c0c0c0 !important;
      border: 1px solid #000 !important;
      color: #111 !important;
      border-radius: 0 !important;
      box-shadow: inset 1px 1px 0 #fff, inset -1px -1px 0 #7f7f7f !important;
      font-size: 12px !important;
      font-weight: 400 !important;
      cursor: pointer !important;
    }

    button:active,
    input[type="submit"]:active {
      box-shadow: inset 1px 1px 0 #7f7f7f, inset -1px -1px 0 #fff !important;
      transform: translate(1px, 1px);
    }

    .sib-form-message-panel,
    .entry__error,
    .sib-form-block__error {
      border: 1px solid #7b7b7b !important;
      background: #efefef !important;
      color: #111 !important;
      padding: 6px 8px !important;
      margin-top: 8px !important;
    }

    a {
      color: #111 !important;
    }
  </style>
`;

const injectedScript = `
  <script id="mitch-mailing-list-script">
    (() => {
      const applyMitchMailingListSkin = () => {
        const doc = document;
        if (!doc.body) return;

        const form = doc.querySelector('form');
        if (!form) return;

        doc.querySelectorAll('img, .sib-form-block__image, .image-container, .header-banner, .sib-form-block--image')
          .forEach((node) => node.remove());

        if (!doc.querySelector('.mitch-mailing-list-copy')) {
          const copy = doc.createElement('div');
          copy.className = 'mitch-mailing-list-copy';
          copy.innerHTML =
            '<h1>Mailing List Subscription</h1><p>Register email address to receive system updates.</p>';
          form.parentElement?.insertBefore(copy, form);
        }

        const emailInput =
          form.querySelector('input[type="email"]') ||
          form.querySelector('input[name="EMAIL"]') ||
          form.querySelector('input[id*="EMAIL"]');

        if (emailInput instanceof HTMLInputElement) {
          emailInput.placeholder = 'user@domain.com';
          const label =
            form.querySelector('label[for="' + emailInput.id + '"]') ||
            emailInput.closest('.entry__field, .sib-input, .form__entry')?.querySelector('label');
          if (label) {
            label.textContent = 'Email Address';
          } else if (emailInput.parentElement && !emailInput.parentElement.querySelector('.mitch-mailing-list-label')) {
            const fallbackLabel = doc.createElement('label');
            fallbackLabel.className = 'mitch-mailing-list-label';
            fallbackLabel.textContent = 'Email Address';
            emailInput.parentElement.insertBefore(fallbackLabel, emailInput);
          }
        }

        const submit =
          form.querySelector('button[type="submit"]') ||
          form.querySelector('input[type="submit"]');
        if (submit instanceof HTMLInputElement) {
          submit.value = 'Subscribe';
        } else if (submit instanceof HTMLElement) {
          submit.textContent = 'Subscribe';
        }

        doc.querySelectorAll('.sib-form-block__description, .sib-text-form-block, .sib-form-block__image')
          .forEach((node) => {
            if (!(node instanceof HTMLElement)) return;
            if (node.closest('.mitch-mailing-list-copy')) return;
            const text = (node.textContent || '').trim();
            if (text) node.style.display = 'none';
          });

        doc.querySelectorAll('.sib-form-message-panel, .entry__error, .sib-form-block__error').forEach((node) => {
          const element = node;
          const text = (element.textContent || '').toLowerCase();
          if (text.includes('success') || text.includes('confirm') || text.includes('subscribed')) {
            element.textContent = 'Subscription successful.';
          } else if (text) {
            element.textContent = 'Submission failed. Retry.';
          }
        });
      };

      document.addEventListener('DOMContentLoaded', applyMitchMailingListSkin);
      window.addEventListener('load', applyMitchMailingListSkin);
      new MutationObserver(applyMitchMailingListSkin).observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    })();
  </script>
`;

export async function GET() {
  try {
    const response = await fetch(BREVO_FORM_URL, {
      cache: "no-store",
      headers: {
        "User-Agent": "MitchOS88/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Brevo form request failed with ${response.status}`);
    }

    const html = await response.text();
    const withHeadInjection = html.includes("</head>")
      ? html.replace("</head>", `${injectedStyle}${injectedScript}</head>`)
      : `${injectedStyle}${injectedScript}${html}`;

    return new Response(withHeadInjection, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    const fallback = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Mailing List</title>
          ${injectedStyle}
        </head>
        <body>
          <div class="mitch-mailing-list-copy">
            <h1>Mailing List Subscription</h1>
            <p>Submission failed. Retry.</p>
          </div>
        </body>
      </html>`;
    return new Response(fallback, {
      status: 502,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
}
