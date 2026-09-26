// @card group="Feedback" height=200
import { C, mount } from "./_mount.js";

mount(<div className="cl-col" style={{gap:10}}><C.Banner tone="ai" title="Clio AI is connected." action={<C.Button size="sm">Open chat</C.Button>}>Summaries and chat use gemma4 running locally.</C.Banner><C.Banner tone="danger" title="Sync error:" action={<C.Button size="sm" variant="secondary">Retry</C.Button>}>Nextcloud returned 401. Uploads are queued on this device.</C.Banner><C.Banner tone="success" title="Imported.">arXiv 2512.02667 saved to Papers.</C.Banner></div>);
