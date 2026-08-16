window.__topicsPromise = fetch('/api/topics').then(function (response) {
  if (!response.ok) {
    throw new Error('API error ' + response.status);
  }
  return response.json();
});
