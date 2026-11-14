'use client';
// The part of the two entry forms that depends on the category. Switchgear, switchboards and breakers
// are described by voltage, current and interrupting rating. A transformer is described by kVA and two
// voltages, and a UPS, generator, CDU or chiller by its capacity and voltage. Asking a chiller for its amps
// would tell anyone in the trade that the form was not built for them.
// The server checks the same rules again, so this only decides which fields are on screen.
import { useState } from 'react';
import { capacityUnit, CATEGORIES, CONDITIONS, OEMS, STATES } from '@/lib/labels';

const EXAMPLE: Record<string, { model?: string; capacity?: string; enclosure?: string; standard?: string }> = {
  switchgear: { model: 'Magnum DS', enclosure: 'NEMA 1', standard: 'UL 1558' },
  switchboard: { model: 'Pow-R-Line', enclosure: 'NEMA 1', standard: 'UL 891' },
  breaker: { model: 'Emax 2 E4.2', standard: 'UL 1066' },
  transformer: { model: 'Pad-mount, liquid filled', capacity: '2500', enclosure: 'NEMA 3R', standard: 'IEEE C57.12.34' },
  ups: { capacity: '1000', standard: 'UL 1778' },
  generator: { capacity: '2500', enclosure: 'Sound attenuated', standard: 'UL 2200' },
  cdu: { model: 'XDU1350', capacity: '1350' },
  chiller: { capacity: '500', standard: 'AHRI 550/590' },
};
const CONFIG_HINT: Record<string, string> = {
  switchgear: 'Per lineup: 4,000 A main, 4,000 A tie, eight feeders from 800 to 1,600 A. Drawout breakers.',
  switchboard: 'Per board: 3,000 A main, twelve molded-case feeders from 250 to 800 A.',
  breaker: 'Drawout, electronic trip units, cradles included.',
  transformer: 'Delta primary, 480Y/277 V secondary, 5.75% impedance, taps at 2.5% steps, loop feed.',
  ups: 'Double conversion, 480 V in and out, lithium-ion cabinets for five minutes at full load.',
  generator: 'Diesel, standby rated, EPA Tier 2, 24-hour base tank, paralleling controls.',
  cdu: 'Liquid to liquid, redundant pumps, PG25 on the technology loop.',
  chiller: 'Air cooled, screw compressors, free cooling coils, 60 Hz.',
};

const Volts = ({ name, title, placeholder, hint = true }: { name: string; title: string; placeholder: string; hint?: boolean }) => (
  <label>
    <span>{title}{hint && <> <span className="hint">13800 for 13.8 kV</span></>}</span>
    <input name={name} type="number" required min={100} max={800000} step={1} placeholder={placeholder} />
  </label>
);

function Category({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label>Category
      <select name="category" required value={value} onChange={e => onChange(e.target.value)}>
        {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

/** Equipment and nameplate ratings on the listing form. */
export function ListingSpec() {
  const [category, setCategory] = useState(CATEGORIES[0][0]);
  const unit = capacityUnit(category);
  const transformer = category === 'transformer';
  const eg = EXAMPLE[category] ?? {};
  return (
    <>
      <fieldset>
        <legend>Equipment</legend>
        <div className="fields">
          <Category value={category} onChange={setCategory} />
          <label>OEM<input name="oem" required maxLength={40} placeholder="Eaton" list="oems" autoComplete="off" /></label>
          <label>Model or line<input name="model" maxLength={60} placeholder={eg.model} /></label>
        </div>
        <datalist id="oems">{OEMS.map(o => <option key={o} value={o} />)}</datalist>
      </fieldset>
      <fieldset>
        <legend>Nameplate ratings</legend>
        {unit ? (
          <div className="fields" key="capacity">
            <label>Capacity ({unit})<input name="capacity" type="number" required min={1} max={500000} step={1} placeholder={eg.capacity} /></label>
            <Volts name="voltage_v" title={transformer ? 'Primary voltage (V)' : category === 'generator' ? 'Output voltage (V)' : 'Supply voltage (V)'} placeholder={transformer ? '13800' : '480'} />
            {transformer && <Volts name="secondary_v" title="Secondary voltage (V)" placeholder="480" hint={false} />}
          </div>
        ) : (
          <div className="fields" key="current">
            <Volts name="voltage_v" title="Voltage (V)" placeholder="480" />
            <label>Rated current (A)<input name="amps" type="number" required min={1} max={20000} step={1} placeholder="4000" /></label>
            <label><span>Interrupting rating (kAIC) <span className="hint">optional</span></span><input name="kaic" type="number" min={1} max={250} step={1} placeholder="65" /></label>
          </div>
        )}
        <div className="fields">
          <label>Enclosure<input name="enclosure" maxLength={30} placeholder={eg.enclosure} /></label>
          <label>Standard<input name="standard" maxLength={30} placeholder={eg.standard} /></label>
          <label>Condition<select name="condition">{CONDITIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        </div>
        <label>
          <span>Configuration <span className="hint">matched buyers see this before the NDA, so leave out names and places</span></span>
          <textarea name="configuration" maxLength={600} placeholder={CONFIG_HINT[category]} />
        </label>
      </fieldset>
    </>
  );
}

/** What is needed and the ratings it must meet, on the request form. */
export function RequestSpec() {
  const [category, setCategory] = useState(CATEGORIES[0][0]);
  const unit = capacityUnit(category);
  const transformer = category === 'transformer';
  const eg = EXAMPLE[category] ?? {};
  return (
    <>
      <fieldset>
        <legend>What you need</legend>
        <div className="fields">
          <Category value={category} onChange={setCategory} />
          <label>Quantity<input name="quantity" type="number" defaultValue={1} min={1} max={500} step={1} required /></label>
          <label>Site<select name="site_state" required defaultValue=""><option value="" disabled>Choose a state</option>{STATES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        </div>
      </fieldset>
      <fieldset>
        <legend>Required ratings</legend>
        {unit ? (
          <div className="fields" key="capacity">
            <label>Minimum capacity ({unit})<input name="capacity_min" type="number" required min={1} max={500000} step={1} placeholder={eg.capacity} /></label>
            <Volts name="voltage_v" title={transformer ? 'Primary voltage (V)' : category === 'generator' ? 'Output voltage (V)' : 'Supply voltage (V)'} placeholder={transformer ? '13800' : '480'} />
            {transformer && <Volts name="secondary_v" title="Secondary voltage (V)" placeholder="480" hint={false} />}
          </div>
        ) : (
          <div className="fields" key="current">
            <Volts name="voltage_v" title="System voltage (V)" placeholder="480" />
            <label>Minimum current (A)<input name="amps_min" type="number" required min={1} max={20000} step={1} placeholder="4000" /></label>
            <label><span>Minimum kAIC <span className="hint">optional</span></span><input name="kaic_min" type="number" min={1} max={250} step={1} placeholder="65" /></label>
          </div>
        )}
        <div className="fields">
          <label>Enclosure<input name="enclosure" maxLength={30} placeholder={eg.enclosure} /></label>
          <label><span>Acceptable OEMs <span className="hint">comma separated, blank for any</span></span><input name="acceptable_oems" maxLength={300} placeholder="Eaton, Schneider Electric, ABB" /></label>
        </div>
        <div role="group" aria-labelledby="cond-label" className="group">
          <span id="cond-label" className="group-label">Acceptable condition</span>
          <div className="choices">
            {CONDITIONS.map(([v, l]) => <label key={v}><input type="checkbox" name="conditions_ok" value={v} defaultChecked={v !== 'used'} />{l}</label>)}
          </div>
        </div>
      </fieldset>
    </>
  );
}
