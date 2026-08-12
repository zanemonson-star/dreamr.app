import './globals.css';

export const metadata = {
  title: 'DREAMR',
  description: "Turn your dream into a roadmap.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
