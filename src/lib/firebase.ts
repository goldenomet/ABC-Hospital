import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, type User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Add required Google Workspace scopes for Sheets, Drive and Gmail
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://mail.google.com/');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else {
        // If we have a user but no cached token, we can trigger sign-in or let the UI ask for sign-in
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Start Google sign-in
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain access token from Google.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

export interface LeadDetails {
  name: string;
  email: string;
  phone: string;
  lastMessage: string;
}

/**
 * Searches for 'ABC Hospital Patient Leads' Google Sheet.
 * If not found, creates it and appends a header row.
 * Then, appends the patient lead row to it.
 */
export const syncPatientLeadToSheets = async (lead: LeadDetails): Promise<{ spreadsheetId: string; webViewLink?: string }> => {
  const token = getAccessToken();
  if (!token) {
    throw new Error('User is not authenticated or access token is expired.');
  }

  // 1. Search for existing sheet
  const searchQuery = encodeURIComponent("name = 'ABC Hospital Patient Leads' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${searchQuery}&fields=files(id,name,webViewLink)`;

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!searchRes.ok) {
    const errText = await searchRes.text();
    console.error('Google Drive search error:', errText);
    throw new Error('Failed to search Google Drive for existing spreadsheet.');
  }

  const searchData = await searchRes.json();
  let spreadsheetId = '';
  let webViewLink = '';

  if (searchData.files && searchData.files.length > 0) {
    spreadsheetId = searchData.files[0].id;
    webViewLink = searchData.files[0].webViewLink || '';
  } else {
    // 2. Create a new Spreadsheet
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          title: 'ABC Hospital Patient Leads'
        }
      })
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error('Google Sheets create error:', errText);
      throw new Error('Failed to create a new Google Sheet.');
    }

    const createData = await createRes.json();
    spreadsheetId = createData.spreadsheetId;
    webViewLink = createData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

    // 3. Append headers to the newly created sheet
    const headers = [
      ['Timestamp', 'Patient Name', 'Email', 'Phone', 'Latest Chat Query / Lead Context', 'Status']
    ];

    const headerRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:append?valueInputOption=USER_ENTERED`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: headers
      })
    });

    if (!headerRes.ok) {
      console.error('Failed to write headers to the new sheet.');
    }
  }

  // 4. Append lead details
  const timestamp = new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' });
  const rowData = [
    [
      timestamp,
      lead.name || 'Anonymous Patient',
      lead.email || 'Not provided',
      lead.phone || 'Not provided',
      lead.lastMessage || 'Initial Consultation / Visit',
      'Active Lead (Chasing)'
    ]
  ];

  const appendRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:append?valueInputOption=USER_ENTERED`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values: rowData
    })
  });

  if (!appendRes.ok) {
    const errText = await appendRes.text();
    console.error('Google Sheets append error:', errText);
    throw new Error('Failed to append lead details to Google Sheet.');
  }

  return { spreadsheetId, webViewLink };
};

export interface EmailParams {
  to: string;
  subject: string;
  body: string;
}

/**
 * Sends an email using the Gmail API.
 * Converts to RFC 2822 format and base64url encodes it.
 */
export const sendEmailViaGmail = async (params: EmailParams): Promise<{ id: string }> => {
  const token = getAccessToken();
  if (!token) {
    throw new Error('User is not authenticated or access token is expired.');
  }

  const { to, subject, body } = params;
  if (!to || !to.includes('@')) {
    throw new Error('A valid email address is required.');
  }

  // Construct raw RFC 2822 message
  const emailLines = [
    `To: ${to}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${subject}`,
    '',
    body
  ];
  const emailContent = emailLines.join('\r\n');

  // Base64url encoding
  const base64UrlEncoded = btoa(unescape(encodeURIComponent(emailContent)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      raw: base64UrlEncoded
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Gmail Send API error:', errText);
    throw new Error('Failed to send email via Gmail API.');
  }

  return await response.json();
};

