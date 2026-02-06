import { Link } from 'react-router-dom'
import coverImg from '@/assets/img/cover.png'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function Home() {
  return (
    <section className="relative w-full overflow-hidden [&>img]:block [&>img]:align-bottom">
      <img
        src={coverImg}
        alt="City by bike"
        className="w-full h-auto"
      />
      <div className="absolute inset-0 bg-black/40 pointer-events-none" aria-hidden />
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 max-w-2xl mx-auto px-6 text-center text-white pointer-events-none [&_a]:pointer-events-auto">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 drop-shadow-md">
          Rediscover the city by bike
        </h1>
        <p className="text-xl md:text-2xl mb-8 text-white/95 drop-shadow-md">
          It's available 24/7, just hop on!
        </p>
        <p className="text-base mb-3 text-white/90">
          Already registered?
        </p>
        <Link
          to="/login"
          className={cn(
            buttonVariants({ variant: 'secondary' }),
            'bg-white text-gray-900 hover:bg-gray-100 inline-block'
          )}
        >
          Log in
        </Link>
      </div>
    </section>
  )
}
