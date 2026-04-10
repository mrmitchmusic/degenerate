const BREVO_FORM_URL =
  "https://0a026ca3.sibforms.com/serve/MUIFADeSGI6f9MdcaIxws8gsQIhKTdNbBFk31R6KC5u6VSSeksoqqttCBdD6F0dfuctR_kTZ-QvCMRucy1ILGwm7wf9HS-t8DF8fGsd214O7uIvqCuxF5JM9vqdNWscE2S0y2zpIvBdlOD-dWNRIqqFmSForYiPN_pTk6oiPh0UfgHgMyI7-CwkwSr_PvGsaG-fXlS6cMzVSgNMo";
const BREVO_FORM_BASE_URL = "https://0a026ca3.sibforms.com/";

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
      text-align: left !important;
    }

    *, *::before, *::after {
      box-sizing: border-box;
      border-radius: 0 !important;
      box-shadow: none !important;
      font-family: Geneva, Arial, sans-serif !important;
    }

    #sib-form-container,
    #sib-container,
    .sib-form,
    .sib-form-container,
    .sib-container,
    .sib-container--large,
    .sib-container--vertical,
    form#sib-form {
      width: 100% !important;
      max-width: none !important;
      margin: 0 !important;
      padding: 0 !important;
      background: transparent !important;
      border: 0 !important;
    }

    .sib-form-block,
    .sib-input,
    .entry_block,
    .entry__field,
    .form__entry,
    .entry__specification {
      margin: 0 0 8px !important;
      padding: 0 !important;
      background: transparent !important;
      border: 0 !important;
    }

    .entry__label,
    label {
      display: block !important;
      margin: 0 0 4px !important;
      font-size: 12px !important;
      font-weight: 400 !important;
      color: #111 !important;
      text-align: left !important;
    }

    input[type="text"],
    input[type="email"] {
      width: 100% !important;
      min-height: 28px !important;
      padding: 4px 6px !important;
      background: #ffffff !important;
      border: 1px solid #000000 !important;
      color: #111111 !important;
      font-size: 12px !important;
      outline: none !important;
    }

    input::placeholder {
      color: #8f9aaa !important;
      opacity: 1 !important;
    }

    button,
    input[type="submit"] {
      min-width: 110px !important;
      min-height: 28px !important;
      padding: 4px 12px !important;
      background: #c0c0c0 !important;
      border: 1px solid #000 !important;
      color: #111 !important;
      font-size: 12px !important;
      font-weight: 400 !important;
      text-align: center !important;
      box-shadow: inset 1px 1px 0 #fff, inset -1px -1px 0 #7f7f7f !important;
      cursor: pointer !important;
    }

    button:active,
    input[type="submit"]:active {
      box-shadow: inset 1px 1px 0 #7f7f7f, inset -1px -1px 0 #fff !important;
      transform: translate(1px, 1px);
    }

    .sib-form-block__button-with-loader svg {
      display: none !important;
    }

    .entry__specification,
    .sib-text-form-block,
    .sib-image-form-block,
    .sib-form-block[style*="font-size:32px"] {
      display: none !important;
    }

    #error-message,
    #success-message {
      display: none;
      max-width: none !important;
      margin: 0 0 8px !important;
      padding: 6px 8px !important;
      border: 1px solid #7b7b7b !important;
      background: #efefef !important;
      color: #111 !important;
      font-size: 12px !important;
      text-align: left !important;
    }

    #error-message[data-visible="true"],
    #success-message[data-visible="true"] {
      display: block !important;
    }

    .sib-form-message-panel__inner-text {
      color: #111 !important;
    }

    .g-recaptcha {
      margin: 6px 0 8px !important;
    }
  </style>
`;

const injectedScript = `
  <script id="mitch-mailing-list-script">
    (() => {
      const errorPanel = () => document.getElementById('error-message');
      const successPanel = () => document.getElementById('success-message');

      const hidePanels = () => {
        [errorPanel(), successPanel()].forEach((panel) => {
          if (!panel) return;
          panel.setAttribute('data-visible', 'false');
        });
      };

      const updatePanels = () => {
        const error = errorPanel();
        const success = successPanel();
        if (error) {
          const text = (error.textContent || '').trim().toLowerCase();
          if (text && !text.includes('could not be saved')) {
            error.setAttribute('data-visible', 'true');
            const inner = error.querySelector('.sib-form-message-panel__inner-text');
            if (inner) inner.textContent = 'Submission failed. Retry.';
          } else {
            error.setAttribute('data-visible', 'false');
          }
        }
        if (success) {
          const text = (success.textContent || '').trim();
          if (text) {
            success.setAttribute('data-visible', 'true');
            const inner = success.querySelector('.sib-form-message-panel__inner-text');
            if (inner) inner.textContent = 'Subscription successful.';
          } else {
            success.setAttribute('data-visible', 'false');
          }
        }
      };

      const setup = () => {
        const form = document.getElementById('sib-form');
        if (!form) return false;

        const input = document.getElementById('EMAIL');
        const label = document.querySelector('label[for="EMAIL"]');
        const submit = form.querySelector('button[type="submit"], input[type="submit"]');

        if (input instanceof HTMLInputElement) {
          input.type = 'email';
          input.placeholder = 'user@domain.com';
        }

        if (label) {
          label.textContent = 'Email Address';
        }

        if (submit instanceof HTMLInputElement) {
          submit.value = 'Subscribe';
        } else if (submit instanceof HTMLElement) {
          submit.textContent = 'Subscribe';
        }

        form.setAttribute('action', ${JSON.stringify(BREVO_FORM_URL)});
        form.setAttribute('target', '_self');

        hidePanels();
        updatePanels();

        form.addEventListener('submit', () => {
          hidePanels();
        });

        const observer = new MutationObserver(updatePanels);
        if (errorPanel()) observer.observe(errorPanel(), { childList: true, subtree: true, characterData: true });
        if (successPanel()) observer.observe(successPanel(), { childList: true, subtree: true, characterData: true });

        return true;
      };

      let tries = 0;
      const timer = setInterval(() => {
        tries += 1;
        if (setup() || tries > 20) {
          clearInterval(timer);
        }
      }, 300);

      document.addEventListener('DOMContentLoaded', setup, { once: true });
      window.addEventListener('load', setup, { once: true });
    })();
  </script>
`;

function transformBrevoHtml(html: string) {
  const withBase = html.includes("</head>")
    ? html.replace("</head>", `<base href="${BREVO_FORM_BASE_URL}">${injectedStyle}${injectedScript}</head>`)
    : `<base href="${BREVO_FORM_BASE_URL}">${injectedStyle}${injectedScript}${html}`;

  return withBase
    .replace(/<div style="padding:\s*8px 0;">\s*<div[\s\S]*?Mr\. Mitch Mailing List[\s\S]*?<\/div>\s*<\/div>/i, "")
    .replace(/<div style="padding:\s*8px 0;">\s*<div class="sib-form-block"[\s\S]*?Subscribe to the newsletter and stay updated\.[\s\S]*?<\/div>\s*<\/div>/i, "")
    .replace(/<div style="padding:\s*8px 0;">\s*<div[\s\S]*?sib-image-form-block[\s\S]*?<\/div>\s*<\/div>/i, "")
    .replace(/Enter your email address to subscribe/gi, "Email Address")
    .replace(/placeholder="EMAIL"/gi, 'placeholder="user@domain.com"')
    .replace(/>\s*SUBSCRIBE\s*</g, ">Subscribe<");
}

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
    return new Response(transformBrevoHtml(html), {
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
          <div style="border:1px solid #7b7b7b;background:#efefef;padding:8px;">Unable to load mailing list form.</div>
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
