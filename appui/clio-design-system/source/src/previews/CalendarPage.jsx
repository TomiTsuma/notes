// @card group="Pages" height=860 width=1440 page
import { C, mount } from "./_mount.js";
import { App } from "./_shell.jsx";
const days = [['Mon', 21], ['Tue', 22], ['Wed', 23], ['Thu', 24], ['Fri', 25], ['Sat', 26], ['Sun', 27]];
const ev = { 0: [[1, 1.5, 'Read EDM paper', 'sky', '09:00–10:30', 1]], 1: [[3, 1, 'Lab meeting', 'rose', '11:00–12:00']], 2: [[0.5, 1, 'Gym', 'stone', '08:30–09:30'], [5, 2, 'Write methods', 'lilac', '13:00–15:00']],
  3: [[2, 1.5, 'Screening pass', 'lilac', '10:00–11:30']], 4: [[1, 1, 'Read GVT §4', 'lilac', '09:00–10:00', 1], [3.5, 0.75, 'Lab meeting', 'rose', '11:30–12:15'], [6.5, 1, 'Extraction review', 'sage', '14:30–15:30']], 5: [[2, 2, 'Soil spectra run', 'sage', '10:00–12:00']], 6: [] };
const H = 56;
mount(<App view="calendar" crumbs={['Home', 'Calendar']}>
  <div className="cl-view" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24, paddingTop: 24 }}>
    <div className="cl-col" style={{ gap: 16 }}>
      <C.Button variant="primary" icon="plus" block>New event</C.Button>
      <C.Card><C.MiniCalendar marked={[3, 9, 14, 18, 21, 22, 23, 24, 25, 26]} /></C.Card>
      <C.Card style={{ padding: 14 }}><div className="cl-overline" style={{ marginBottom: 10 }}>Projects</div>
        {[['Molecular Gen', 'lilac'], ['MSc Dissertation', 'sky'], ['Soil Spectra', 'sage'], ['Personal', 'rose']].map(([n, t]) => <div key={n} style={{ marginBottom: 6 }}><C.Checkbox defaultChecked strike={false}><span className="cl-row" style={{ gap: 8 }}><i className={'s-' + t} style={{ width: 8, height: 8, borderRadius: 3 }} />{n}</span></C.Checkbox></div>)}
        <div style={{ borderTop: '1px solid var(--line)', marginTop: 10, paddingTop: 10 }}><C.Button variant="ghost" size="sm" icon="download">Import .ics</C.Button></div>
      </C.Card>
    </div>
    <div style={{ minWidth: 0 }}>
      <div className="cl-row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <div className="cl-row"><h1 className="cl-h-display" style={{ fontSize: 28 }}>September 2026</h1><C.IconButton icon="chevron-left" label="Previous week" outlined /><C.IconButton icon="chevron-right" label="Next week" outlined /><C.Button size="sm">Today</C.Button></div>
        <C.SegmentedControl value="week" options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} />
      </div>
      <div className="cl-week-grid">
        <div className="h" />
        {days.map(([d, n], i) => <div key={d} className={'h' + (i === 4 ? ' today' : '')}>{d}<b>{n}</b></div>)}
        <div className="tcol">{['08', '09', '10', '11', '12', '13', '14', '15', '16'].map((t) => <div key={t}>{t}:00</div>)}</div>
        {days.map((d, i) => (
          <div key={i} className="day" style={{ height: 9 * H }}>
            {i === 4 && <div className="now" style={{ top: 6.2 * H }} />}
            {ev[i].map(([s, l, t, tone, time, done]) => <C.EventBlock key={t} title={t} time={time} tone={tone} done={!!done} style={{ top: s * H + 2, height: l * H - 4 }} />)}
          </div>
        ))}
      </div>
    </div>
  </div>
</App>);
