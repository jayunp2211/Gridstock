// Signed-in pages and the sign-in page are of no use to a search engine. The NDA page opts back in.
export const metadata = { robots: { index: false, follow: false } };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <main className="app" id="main">{children}</main>;
}
