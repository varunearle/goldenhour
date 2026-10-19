import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';

const UPDATED = '19 October 2026';

function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link to="/" className="text-lg font-bold">Golden Hour</Link>
          <nav className="flex gap-4 text-[13px]">
            <NavLink to="/privacy" className={({ isActive }) => (isActive ? 'text-white underline underline-offset-4' : 'text-[#D5DFE8] hover:text-white')}>Privacy policy</NavLink>
            <NavLink to="/terms" className={({ isActive }) => (isActive ? 'text-white underline underline-offset-4' : 'text-[#D5DFE8] hover:text-white')}>Terms and conditions</NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-[28px] font-bold leading-9 tracking-tight">{title}</h1>
        <p className="mt-1 text-muted">Last updated {UPDATED}</p>
        <div className="mt-8 space-y-8 text-[15px] leading-7">{children}</div>
        <div className="mt-12 border-t border-line pt-5 text-[13px]">
          <Link to="/" className="text-navy underline underline-offset-4">Back to Golden Hour</Link>
        </div>
      </main>
    </div>
  );
}

function Part({ h, children }: { h: string; children: ReactNode }) {
  return <section><h2 className="mb-2 text-lg font-bold">{h}</h2><div className="space-y-3">{children}</div></section>;
}
const List = ({ items }: { items: ReactNode[] }) => (
  <ul className="list-disc space-y-1.5 pl-5 marker:text-faint">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
);

export function Privacy() {
  return (
    <LegalLayout title="Privacy policy">
      <p>Golden Hour is a student project for the course 24CSEN2151 Artificial Intelligence at GITAM University. This page explains what it stores and where.</p>
      <Part h="What Golden Hour stores">
        <List items={[
          'Calls you log: the location text you type, the date and time, your answers and the call status.',
          'The names entered on the Settings page.',
          'Which demo account you signed in with, kept only until the browser tab is closed.',
        ]} />
      </Part>
      <Part h="Where it is stored">
        <p>Everything listed above stays in your own browser on this device, in its local storage. Golden Hour has no server or database, so none of it is sent to the author or anyone else.</p>
        <p>Golden Hour sets no cookies, runs no analytics or tracking, and loads no third-party scripts. Its fonts and data are packaged with the app.</p>
      </Part>
      <Part h="The road collision data">
        <p>
          The collisions shown are from the STATS19 road safety data published by the Department for Transport. The published data has no names, and
          Golden Hour does not show collision reference numbers.
        </p>
      </Part>
      <Part h="Hosting">
        <p>When Golden Hour is opened from a web address, the hosting company may keep standard server logs, such as the IP address of the request and the page requested, under its own privacy policy. Running it on your own computer avoids this.</p>
      </Part>
      <Part h="Your control over the data">
        <List items={[
          <>Settings, <span className="font-semibold">Export calls</span>: download every logged call as a CSV file.</>,
          <>Settings, <span className="font-semibold">Clear calls</span> or <span className="font-semibold">Reset everything</span>: delete what is stored.</>,
          "Clearing this site's data in your browser settings removes everything Golden Hour has stored.",
        ]} />
      </Part>
      <Part h="Please do not enter personal information">
        <p>The demo accounts are shared and the location field is free text. Do not type names, phone numbers or other personal details into it.</p>
      </Part>
      <Part h="Changes">
        <p>If this policy changes, the date at the top of the page changes with it.</p>
      </Part>
    </LegalLayout>
  );
}

export function Terms() {
  return (
    <LegalLayout title="Terms and conditions">
      <p>By using Golden Hour you agree to these terms. They are short and plain because Golden Hour is an academic project, not a service.</p>
      <Part h="Not for real emergencies">
        <p>
          Golden Hour is a teaching demonstration. It is not connected to any emergency service and must not be used to decide a real response.
          In an emergency in India, call 112.
        </p>
      </Part>
      <Part h="What the estimates are">
        <p>
          Risk estimates and priority bands come from a statistical model trained on road collisions in Great Britain in 2015. They are probabilities,
          not diagnoses, and they can be wrong. They are meant to support a trained call handler, never to replace their judgement or a clinical triage
          protocol. The standby points are an analysis of past collision locations, not a deployment plan.
        </p>
      </Part>
      <Part h="Data and licence">
        <p>
          The collision data is the Department for Transport's STATS19 road safety data for 2015. Contains public sector information licensed under the
          Open Government Licence v3.0. The model and evaluation figures come from the author's own run of the training code on that data.
        </p>
      </Part>
      <Part h="Your data">
        <p>Logged calls are stored only in your browser, as the <Link to="/privacy" className="text-navy underline underline-offset-4">privacy policy</Link> describes, and can be lost if browser data is cleared.</p>
      </Part>
      <Part h="Acceptable use">
        <p>Do not try to disrupt the site or its host, and do not present Golden Hour as your own work.</p>
      </Part>
      <Part h="No warranty">
        <p>Golden Hour is provided as it is, without any guarantee that it is available, error-free or fit for a particular purpose. To the extent the law allows, the author is not responsible for any loss arising from its use.</p>
      </Part>
      <Part h="Changes">
        <p>These terms may be updated; the date at the top shows when they last changed.</p>
      </Part>
    </LegalLayout>
  );
}
