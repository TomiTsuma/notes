const { createClient } = require('webdav');
async function test() {
  const url = 'http://100.100.133.10:30027/remote.php/webdav';
  const user = 'aeacus';
  const pass = 'Tobirama13';
  try {
    const client = createClient(url, { username: user, password: pass });
    const success = await client.exists('/');
    console.log('Connection successful:', success);
  } catch (e) {
    console.error('Connection failed:', e.message);
  }
}
test();
