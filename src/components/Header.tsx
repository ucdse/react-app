import { Button } from '@/components/ui/button'

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full bg-gray-200 dark:bg-gray-800">
      <div className="flex h-12 w-full items-center justify-between px-4">
        <Button variant="ghost" className="text-foreground hover:bg-gray-300 dark:hover:bg-gray-700">
          News
        </Button>
        <Button variant="ghost" className="text-foreground hover:bg-gray-300 dark:hover:bg-gray-700">
          Login
        </Button>
      </div>
    </header>
  )
}
