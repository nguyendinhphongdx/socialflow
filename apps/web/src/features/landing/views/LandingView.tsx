import type { FC } from 'react'
import { CtaSection } from '../components/CtaSection'
import { FeaturesSection } from '../components/FeaturesSection'
import { Footer } from '../components/Footer'
import { HeroSection } from '../components/HeroSection'
import { HowItWorks } from '../components/HowItWorks'
import { Navbar } from '../components/Navbar'
import { PricingTeaser } from '../components/PricingTeaser'
import { TestimonialsSection } from '../components/TestimonialsSection'

export const LandingView: FC = () => {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <FeaturesSection />
        <HowItWorks />
        <PricingTeaser />
        <TestimonialsSection />
        <CtaSection />
      </main>
      <Footer />
    </div>
  )
}
