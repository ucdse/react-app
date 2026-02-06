import { Outlet } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="shrink-0">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
