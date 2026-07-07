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

export interface GmailMessage {
  id: string;
  threadId: string;
  subject?: string;
  snippet?: string;
  date?: string;
  to?: string;
  from?: string;
}

/**
 * Lists the user's recent emails using the Gmail API.
 * Optionally filters with a query string.
 */
export const listRecentEmails = async (query = '', maxResults = 5): Promise<GmailMessage[]> => {
  const token = getAccessToken();
  if (!token) {
    throw new Error('User is not authenticated or access token is expired.');
  }

  let listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`;
  if (query) {
    listUrl += `&q=${encodeURIComponent(query)}`;
  }

  const response = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Gmail List API error:', errText);
    throw new Error('Failed to list emails from Gmail API.');
  }

  const data = await response.json();
  if (!data.messages || data.messages.length === 0) {
    return [];
  }

  const detailedMessages = await Promise.all(
    data.messages.map(async (msg: { id: string }) => {
      try {
        const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=To&metadataHeaders=From&metadataHeaders=Date`;
        const detailRes = await fetch(detailUrl, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (detailRes.ok) {
          const detailData = await detailRes.json();
          const headers = detailData.payload?.headers || [];
          const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || 'No Subject';
          const to = headers.find((h: any) => h.name.toLowerCase() === 'to')?.value || 'Unknown To';
          const from = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || 'Unknown From';
          const date = headers.find((h: any) => h.name.toLowerCase() === 'date')?.value || '';
          return {
            id: msg.id,
            threadId: detailData.threadId,
            subject,
            snippet: detailData.snippet || '',
            to,
            from,
            date
          };
        }
      } catch (err) {
        console.error(`Failed to fetch details for message ${msg.id}`, err);
      }
      return null;
    })
  );

  return detailedMessages.filter((m): m is GmailMessage => m !== null);
};

/**
 * Fetches the detailed HTML or text content of a specific Gmail message.
 */
export const getEmailDetail = async (id: string): Promise<{ id: string; body: string; subject?: string }> => {
  const token = getAccessToken();
  if (!token) {
    throw new Error('User is not authenticated or access token is expired.');
  }

  const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`;
  const response = await fetch(detailUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch detailed email content.');
  }

  const data = await response.json();
  const headers = data.payload?.headers || [];
  const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || 'No Subject';
  
  // Helper to extract email body from payload parts
  const extractBody = (payload: any): string => {
    if (!payload) return '';
    if (payload.body?.data) {
      try {
        const base64 = payload.body.data.replace(/-/g, '+').replace(/_/g, '/');
        return decodeURIComponent(escape(atob(base64)));
      } catch (e) {
        console.error('Body decode error:', e);
        return '';
      }
    }
    if (payload.parts) {
      for (const part of payload.parts) {
        const body = extractBody(part);
        if (body) return body;
      }
    }
    return '';
  };

  const body = extractBody(data.payload) || data.snippet || 'No content';
  return { id, body, subject };
};


