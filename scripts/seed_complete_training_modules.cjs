const path = require('node:path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in the root .env file.');
}

const client = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function learningMaterial(en, af, pt) {
  return { en, af, pt };
}

function scenario(slug, title, prompt, dimensions, correctIndex, choices, explanation) {
  if (choices.length !== 4 || choices.filter((_, index) => index === correctIndex).length !== 1) {
    throw new Error(`Scenario ${slug} must define four choices and one correct answer.`);
  }
  return {
    slug,
    content: { en: { title, scenario: prompt } },
    riskDimensions: dimensions,
    explanation,
    options: choices.map((text, index) => ({
      optionKey: String.fromCharCode(65 + index),
      content: { en: text },
      isCorrect: index === correctIndex,
      feedback: {
        en: {
          choice: index === correctIndex
            ? 'That is the safer response.'
            : 'That response could increase risk or delay a safe response.',
          explanation,
        },
      },
    })),
  };
}

const modules = [
  {
    slug: 'phishing-and-suspicious-links',
    title: {
      en: 'Phishing and suspicious links',
      af: 'Uitvissing en verdagte skakels',
      pt: 'Phishing e links suspeitos',
    },
    description: {
      en: 'Spot deceptive messages, links, attachments, and requests before they capture information or access.',
      af: 'Herken misleidende boodskappe, skakels, aanhegsels en versoeke voordat dit inligting of toegang bekom.',
      pt: 'Reconheça mensagens, links, anexos e pedidos enganosos antes que obtenham informação ou acesso.',
    },
    learningMaterial: learningMaterial(
      {
        whyItMatters: 'Phishing borrows the look and language of trusted people or services to make a risky click or disclosure feel routine.',
        warningSigns: 'Unexpected links or files, mismatched sender addresses, urgent threats or rewards, requests to sign in again, and messages that move you away from a known service.',
        bestPractice: 'Pause, avoid the message link, and open the service through a known bookmark or official app. Verify unusual requests through a separate trusted channel and report suspicious messages.',
      },
      {
        whyItMatters: 'Uitvissing boots die voorkoms en taal van vertroude mense of dienste na sodat ’n riskante klik of openbaarmaking normaal voel.',
        warningSigns: 'Onverwagte skakels of lêers, senderadresse wat nie klop nie, dringende dreigemente of belonings, versoeke om weer aan te meld en boodskappe wat jou wegneem van ’n bekende diens.',
        bestPractice: 'Wag, vermy die skakel in die boodskap en open die diens via ’n bekende boekmerk of amptelike toepassing. Bevestig ongewone versoeke via ’n aparte vertroude kanaal en rapporteer verdagte boodskappe.',
      },
      {
        whyItMatters: 'O phishing imita a aparência e a linguagem de pessoas ou serviços de confiança para fazer um clique ou uma divulgação arriscada parecer normal.',
        warningSigns: 'Links ou ficheiros inesperados, endereços do remetente que não coincidem, ameaças ou recompensas urgentes, pedidos para iniciar sessão novamente e mensagens que afastam a pessoa de um serviço conhecido.',
        bestPractice: 'Pare, evite o link da mensagem e abra o serviço por um marcador conhecido ou aplicação oficial. Confirme pedidos invulgares por outro canal de confiança e denuncie mensagens suspeitas.',
      },
    ),
    scenarios: [
      scenario('phishing-document-share', 'A shared document needs a sign-in', 'A message says a coworker shared a document and asks you to sign in through a link you were not expecting. What should you do?', ['Links', 'Credentials'], 2, ['Enter your work password so you do not miss the document.', 'Forward the link to your team to see whether anyone recognizes it.', 'Open the work document service directly and check there; report the unexpected message.', 'Reply with your email address and ask the sender to confirm.'], 'A familiar name can be spoofed. Check the document through the official service instead of trusting a message link.'),
      scenario('phishing-delivery-fee', 'A delivery fee by text', 'A delivery text says your parcel is held and asks for a small fee through a shortened link. You are expecting a parcel. What is safest?', ['Urgency', 'Links'], 1, ['Pay the small fee because you are expecting a delivery.', 'Check the carrier using its official app or a known website, not the text link.', 'Reply with your address to confirm the parcel.', 'Open the link in a private browser window.'], 'A real delivery expectation does not verify the text. Use the carrier’s official channel to check parcel status.'),
      scenario('phishing-qr-login', 'A QR code requests account access', 'A poster at work has a QR code for a new staff portal. After scanning it, the page asks for your work password and MFA approval. What should you do?', ['Credential theft', 'Verification'], 3, ['Approve the MFA prompt because you entered the password.', 'Use the page if its logo looks like the company logo.', 'Ask a coworker to scan and sign in first.', 'Close the page and open the portal from a known company bookmark or contact IT.'], 'QR codes can hide a destination. Start from a known portal and never approve a sign-in you did not initiate there.'),
      scenario('phishing-invoice-attachment', 'An unexpected invoice attachment', 'A supplier email says an invoice is overdue and urges you to enable macros in an attached spreadsheet to view it. What is the safest response?', ['Attachments', 'Urgency'], 0, ['Do not enable macros; verify the invoice with the supplier through a known contact and report the email.', 'Enable macros while offline, then inspect the spreadsheet.', 'Forward the attachment to a personal email so you can open it safely.', 'Reply asking the sender to resend it as a compressed file.'], 'Unexpected executable features in an attachment can run harmful code. Verify the request independently and follow the reporting process.'),
      scenario('phishing-password-expiry', 'A password-expiry warning', 'A pop-up reached from an email says your account will close in ten minutes unless you reset your password on its page. What should you do?', ['Account access', 'Urgency'], 2, ['Enter the current password so the page can find your account.', 'Use the reset link because the warning has your company logo.', 'Close the page and use the organization’s known sign-in page or contact support.', 'Send the warning to coworkers and ask them to click it too.'], 'Urgent password warnings are easy to imitate. Use a known sign-in route and let support verify account notices.'),
      scenario('phishing-callback-number', 'A callback number in an alert', 'A security alert says a payment was blocked and provides a phone number to call immediately. You do not recognize the transaction. What should you do?', ['Impersonation', 'Verification'], 1, ['Call the number in the message before the offer expires.', 'Contact the bank using the number on your card or its official app.', 'Reply with the last four digits of your card.', 'Ignore it because legitimate banks never send alerts.'], 'Use a contact method you already trust. Do not rely on contact details supplied in a suspicious alert.'),
    ],
  },
  {
    slug: 'account-passwords-and-mfa',
    title: {
      en: 'Passwords and multi-factor security',
      af: 'Wagwoorde en multifaktor-sekuriteit',
      pt: 'Palavras-passe e segurança multifator',
    },
    description: {
      en: 'Protect sign-ins, recovery methods, and approval prompts from account takeover.',
      af: 'Beskerm aanmeldings, herstelmetodes en goedkeuringsversoeke teen rekeningoorname.',
      pt: 'Proteja inícios de sessão, métodos de recuperação e pedidos de aprovação contra o roubo de contas.',
    },
    learningMaterial: learningMaterial(
      {
        whyItMatters: 'One reused or disclosed password can unlock several accounts, while stolen recovery codes or unwanted MFA approvals can bypass normal sign-in protections.',
        warningSigns: 'MFA prompts you did not start, requests to read out a code, unexpected password-reset notices, reused-password warnings, and recovery details changed without you.',
        bestPractice: 'Use a unique password stored in an approved password manager, deny unrequested MFA prompts, never share verification codes, and report unexpected account changes promptly.',
      },
      {
        whyItMatters: 'Een hergebruikte of openbaar gemaakte wagwoord kan verskeie rekeninge ontsluit, terwyl gesteelde herstelkodes of ongewenste MFA-goedkeurings gewone aanmeldbeskerming kan omseil.',
        warningSigns: 'MFA-versoeke wat jy nie begin het nie, versoeke om ’n kode voor te lees, onverwagte wagwoordterugstellings, waarskuwings oor hergebruikte wagwoorde en herstelbesonderhede wat sonder jou verander is.',
        bestPractice: 'Gebruik ’n unieke wagwoord in ’n goedgekeurde wagwoordbestuurder, weier MFA-versoeke wat jy nie begin het nie, deel nooit verifikasiekodes nie en rapporteer onverwagte rekeningveranderinge dadelik.',
      },
      {
        whyItMatters: 'Uma palavra-passe reutilizada ou divulgada pode desbloquear várias contas, enquanto códigos de recuperação roubados ou aprovações MFA indesejadas podem contornar proteções normais.',
        warningSigns: 'Pedidos MFA que não iniciou, pedidos para ler um código, avisos inesperados de reposição, alertas de reutilização de palavras-passe e dados de recuperação alterados sem autorização.',
        bestPractice: 'Use uma palavra-passe única guardada num gestor aprovado, recuse pedidos MFA que não iniciou, nunca partilhe códigos de verificação e denuncie alterações inesperadas à conta rapidamente.',
      },
    ),
    scenarios: [
      scenario('account-mfa-fatigue', 'Repeated MFA approvals', 'Your phone receives several sign-in approval prompts while you are not trying to log in. One prompt includes a caller asking you to approve it. What should you do?', ['MFA', 'Impersonation'], 3, ['Approve one prompt to stop the notifications.', 'Read the number shown in the prompt to the caller.', 'Turn off MFA so the prompts stop.', 'Deny the prompts, end the call, and report the activity through your organization’s support channel.'], 'An MFA prompt you did not initiate may mean someone has your password. Deny it and report the attempt; never share or approve a code for someone else.'),
      scenario('account-password-reuse', 'A reused password appears in a breach alert', 'A trusted password manager reports that a password you use on several sites appeared in a breach. What should you do first?', ['Password hygiene', 'Recovery'], 1, ['Wait to see whether any account is actually accessed.', 'Change it to a unique password on every affected account, starting with email and financial accounts.', 'Add a symbol to the reused password on each site.', 'Send the old password to IT in a message so they can check it.'], 'A breached reused password can be tried on multiple services. Replace it with unique passwords and do not send secrets to anyone.'),
      scenario('account-code-request', 'Support asks for a verification code', 'Someone claiming to be IT says they are fixing your account and asks you to read out the one-time code you just received. What is safest?', ['Verification codes', 'Impersonation'], 0, ['Do not share the code; end the contact and reach IT through a known support channel.', 'Read the code because the person already knows your name.', 'Send a screenshot of the code instead.', 'Approve the sign-in and change your password afterward.'], 'One-time codes are equivalent to a temporary key. Real support should not need you to disclose a code to them.'),
      scenario('account-recovery-codes', 'Where to store recovery codes', 'You have generated recovery codes for an important account. Where should they be kept?', ['Recovery', 'Credential protection'], 2, ['In a photo album that automatically syncs to every device.', 'In a note shared with your whole team.', 'In the approved secure password manager or another protected offline location.', 'In an email draft addressed to yourself.'], 'Recovery codes can bypass normal account protections. Store them where only you can access them and avoid broadly synced or shared locations.'),
      scenario('account-password-manager', 'A password manager suggests a unique password', 'A work service asks you to create a password. Your approved password manager offers a long unique password. What should you do?', ['Password hygiene', 'Approved tools'], 3, ['Use the same password you already remember for email.', 'Shorten the generated password to make it easy to type.', 'Save the password in a shared document for convenience.', 'Use and securely store the unique generated password.'], 'Unique passwords limit the damage if one service is compromised. An approved manager helps store them safely.'),
      scenario('account-recovery-change', 'An unexpected recovery-email change', 'You receive a notice that an account recovery email was changed, but you did not make the change. What should you do?', ['Account recovery', 'Incident response'], 1, ['Ignore the notice unless you are locked out.', 'Use the provider’s official site or app to secure the account and contact support through a known route.', 'Reply to the notice with your password to cancel the change.', 'Click any cancellation link in the message without checking its destination.'], 'An unexpected recovery change may be an account takeover attempt. Go directly to the official service and secure the account without trusting message links.'),
    ],
  },
  {
    slug: 'payment-and-invoice-verification',
    title: {
      en: 'Payment and invoice verification',
      af: 'Betaling- en faktuurverifikasie',
      pt: 'Verificação de pagamentos e faturas',
    },
    description: {
      en: 'Verify payment changes and urgent financial requests before money or codes leave your control.',
      af: 'Bevestig betalingsveranderings en dringende finansiële versoeke voordat geld of kodes jou beheer verlaat.',
      pt: 'Confirme alterações de pagamento e pedidos financeiros urgentes antes de enviar dinheiro ou códigos.',
    },
    learningMaterial: learningMaterial(
      {
        whyItMatters: 'Payment fraud often combines authority, urgency, and plausible business details to make an irreversible transfer feel routine.',
        warningSigns: 'New bank details, last-minute invoice changes, secrecy, unusual payment methods, pressure to bypass approval, or a request that differs from the normal vendor process.',
        bestPractice: 'Pause the payment and verify changes using a known contact already on file. Follow approval limits and report suspected fraud promptly; do not use contact details in the change request.',
      },
      {
        whyItMatters: 'Betalingsbedrog kombineer dikwels gesag, dringendheid en geloofwaardige sakebesonderhede sodat ’n onomkeerbare oorbetaling normaal voel.',
        warningSigns: 'Nuwe bankbesonderhede, laaste-minuut-faktuurveranderings, geheimhouding, ongewone betaalmetodes, druk om goedkeuring te omseil of ’n versoek wat van die gewone verskafferproses verskil.',
        bestPractice: 'Wag met die betaling en bevestig veranderings via ’n bekende kontak wat reeds op rekord is. Volg goedkeuringsperke en rapporteer vermoedelike bedrog dadelik; moenie kontakbesonderhede in die versoek gebruik nie.',
      },
      {
        whyItMatters: 'A fraude de pagamentos combina frequentemente autoridade, urgência e detalhes comerciais plausíveis para fazer uma transferência irreversível parecer normal.',
        warningSigns: 'Novos dados bancários, alterações de última hora à fatura, segredo, métodos de pagamento invulgares, pressão para contornar aprovações ou pedidos diferentes do processo normal do fornecedor.',
        bestPractice: 'Suspenda o pagamento e confirme alterações através de um contacto conhecido já registado. Siga os limites de aprovação e denuncie suspeitas rapidamente; não use os contactos incluídos no pedido de alteração.',
      },
    ),
    scenarios: [
      scenario('payment-vendor-bank-change', 'A supplier changes bank details', 'A regular supplier emails a new bank account number and says the current invoice must be paid today. What should you do?', ['Payment fraud', 'Verification'], 2, ['Update the account because the invoice number is familiar.', 'Reply to the email asking whether the change is real.', 'Verify the change with a known supplier contact already on file and follow the approval process.', 'Pay a small test amount to see whether the account works.'], 'A compromised supplier mailbox can send convincing changes. Verify independently using existing contact information before changing payment details.'),
      scenario('payment-gift-cards', 'A manager requests gift cards', 'A message from a manager says they are in a meeting and need gift cards immediately for a client. They ask you to send the redemption codes privately. What is safest?', ['Impersonation', 'Urgency'], 1, ['Buy the cards and send only the first few codes.', 'Verify the request through a known, independent channel and report the unusual payment request.', 'Ask the sender to confirm the client’s name by email.', 'Use a personal card so the request does not delay the client.'], 'Urgency, secrecy, and gift-card codes are strong impersonation signals. Verify independently and follow the organization’s reporting process.'),
      scenario('payment-executive-transfer', 'An urgent executive transfer', 'A caller claiming to be an executive asks you to bypass the normal approval chain for a confidential transfer before a deadline. What should you do?', ['Authority', 'Approval controls'], 3, ['Follow the caller’s instructions because executives can approve exceptions.', 'Split the transfer into smaller payments.', 'Ask the caller to text their employee number.', 'Do not bypass controls; verify through known channels and obtain the required approvals.'], 'Authority and secrecy do not replace payment controls. Verify the request independently and keep required approvals in place.'),
      scenario('payment-payroll-change', 'A payroll account change', 'An employee emails HR asking to redirect their next paycheck to a new bank account and says they cannot take a phone call. What should HR do?', ['Payroll fraud', 'Identity verification'], 0, ['Verify the change using the established employee identity-check process before updating payroll.', 'Make the change because the request came from the employee’s work email.', 'Reply asking them to send a photo of a bank card.', 'Forward the request to the whole department to identify the employee.'], 'A compromised mailbox can send plausible payroll requests. Use the approved identity-check process and limit access to the request.'),
      scenario('payment-invoice-attachment', 'An overdue invoice with a new link', 'A vendor invoice arrives with a new payment portal link and a warning that service will stop unless payment is made within an hour. What is safest?', ['Invoice fraud', 'Links'], 2, ['Pay through the link because the invoice uses the vendor’s logo.', 'Ask the email sender to resend the same link.', 'Open the vendor portal through a known bookmark and confirm the invoice with your usual contact.', 'Ignore all future invoices from that vendor.'], 'Logos and invoice details can be copied. Use the known portal and established vendor contact to verify the payment.'),
      scenario('payment-refund-qr', 'A QR code promises a refund', 'A support message says you are owed a refund and asks you to scan a QR code and enter your banking password to receive it. What should you do?', ['Credential theft', 'Refund fraud'], 1, ['Scan it but do not enter the one-time code.', 'Do not scan or enter credentials; contact the organization through its official app or known number.', 'Send your account number so support can check eligibility.', 'Ask the sender to call you from a private number.'], 'A refund should not require your banking password through a message QR code. Verify through the institution’s official channel and report the message.'),
    ],
  },
];

function validateSeed() {
  if (modules.length !== 3) throw new Error('Exactly three new modules are required.');
  for (const module of modules) {
    if (!['en', 'af', 'pt'].every((language) => module.title[language] && module.description[language] && module.learningMaterial[language])) {
      throw new Error(`Module ${module.slug} is missing localized module content.`);
    }
    if (module.scenarios.length !== 6) throw new Error(`Module ${module.slug} must contain six scenarios.`);
    for (const item of module.scenarios) {
      if (item.options.length !== 4 || item.options.filter((option) => option.isCorrect).length !== 1) {
        throw new Error(`Scenario ${item.slug} must have four options and one correct answer.`);
      }
    }
  }
}

async function checked(query) {
  const result = await query;
  if (result.error) throw result.error;
  return result.data;
}

async function seedModule(module) {
  const existingModule = await checked(client.from('training_modules').select('id').eq('slug', module.slug).maybeSingle());
  let moduleId = existingModule?.id;
  const moduleValues = {
    slug: module.slug,
    title: module.title,
    description: module.description,
    learning_material: module.learningMaterial,
    is_published: false,
    is_assessment: false,
  };

  if (moduleId) {
    await checked(client.from('training_modules').update(moduleValues).eq('id', moduleId));
  } else {
    const createdModule = await checked(client.from('training_modules').insert(moduleValues).select('id').single());
    moduleId = createdModule.id;
  }

  for (const item of module.scenarios) {
    const existingScenario = await checked(client.from('scenarios').select('id,module_id').eq('slug', item.slug).maybeSingle());
    if (existingScenario && existingScenario.module_id !== moduleId) {
      throw new Error(`Scenario slug ${item.slug} already belongs to another module.`);
    }
    const scenarioValues = { module_id: moduleId, slug: item.slug, content: item.content, risk_dimensions: item.riskDimensions };
    let scenarioId = existingScenario?.id;
    if (scenarioId) {
      await checked(client.from('scenarios').update(scenarioValues).eq('id', scenarioId));
    } else {
      const createdScenario = await checked(client.from('scenarios').insert(scenarioValues).select('id').single());
      scenarioId = createdScenario.id;
    }
    await checked(client.from('scenario_options').upsert(item.options.map((option) => ({
      scenario_id: scenarioId,
      option_key: option.optionKey,
      content: option.content,
      is_correct: option.isCorrect,
      feedback: option.feedback,
    })), { onConflict: 'scenario_id,option_key' }));
  }

  const rows = await checked(client.from('scenarios').select('id,slug,scenario_options(option_key,is_correct)').eq('module_id', moduleId));
  if (rows.length !== 6 || rows.some((row) => row.scenario_options.length !== 4 || row.scenario_options.filter((option) => option.is_correct).length !== 1)) {
    throw new Error(`Module ${module.slug} failed its six-scenario/four-option publication checks.`);
  }
  await checked(client.from('training_modules').update({ is_published: true }).eq('id', moduleId));
  console.log(`Published ${module.slug}: ${rows.length} scenarios, 4 options and 1 correct answer each, EN/AF/PT learning material.`);
}

async function main() {
  validateSeed();
  for (const module of modules) await seedModule(module);
  console.log('Direct training catalog seed complete.');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});