export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t bg-gray-100 dark:bg-gray-900 py-6">
      <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
        <p className="mb-1">© {currentYear} React App. All rights reserved.</p>
        <p className="text-xs opacity-80">
          Built with Vite + React + Tailwind CSS
        </p>
      </div>
    </footer>
  )
}
