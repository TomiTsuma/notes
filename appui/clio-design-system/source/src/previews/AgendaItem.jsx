// @card group="Cards" height=200
import { C, mount } from "./_mount.js";

mount(<C.Card style={{padding:'10px 18px',maxWidth:380}}><C.AgendaItem time="09:00" title="Read GVT §4" detail="Molecular Gen" tone="lilac" done /><C.AgendaItem time="11:30" title="Lab meeting" detail="Room 204 · 45 min" tone="rose" /><C.AgendaItem time="14:30" title="Extraction sheet review" detail="Soil Spectra" tone="sage" /></C.Card>);
