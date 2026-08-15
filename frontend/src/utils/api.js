const API_BASE = '/api/v1';

export async function apiFetch(endpoint, options = {}) {
  const token = options.token || localStorage.getItem('fintrack-token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions = {
    method: options.method || 'GET',
    headers,
  };
  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, fetchOptions);

  if (response.status === 204) {
    return null;
  }

  let data = null;
  try {
    data = await response.json();
  } catch (e) {}

  if (!response.ok) {
    const err = new Error(data?.detail || 'API request failed');
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

export async function apiUpload(file, token) {
  const formData = new FormData();
  formData.append('file', file);

  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/transactions/upload`, {
    method: 'POST',
    headers,
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    const err = new Error(data?.detail || 'Statement upload failed');
    err.status = response.status;
    throw err;
  }
  return data;
}

// Day 19: Dry-run preview — parse without inserting, returns row list for review
export async function apiUploadPreview(file, token) {
  const formData = new FormData();
  formData.append('file', file);

  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/transactions/upload/preview`, {
    method: 'POST',
    headers,
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    const err = new Error(data?.detail || 'Preview failed');
    err.status = response.status;
    throw err;
  }
  return data;   // { filename, total_rows, new_rows, duplicate_rows, rows, errors }
}
