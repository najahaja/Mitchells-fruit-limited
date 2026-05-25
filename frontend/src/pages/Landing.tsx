import { useEffect } from "react";
import Navbar from "../components/LandingPage/Navbar";
import HeroSection from "../components/LandingPage/NewHero";
import WhyVaxisSection from "../components/LandingPage/WhyVaxis";
import FeaturesBentoSection from "../components/LandingPage/FeaturesSection";
import IntegrationsSection from "../components/LandingPage/IntegrationsSection";
import SocialProofSection from "../components/LandingPage/SocialProof";
import CTASection from "../components/LandingPage/CTASection";
import Footer from "../components/LandingPage/footer";

export default function Landing() {
  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";
  }, []);

  return (
    <div style={{ fontFamily: "'Sora', sans-serif", WebkitFontSmoothing: "antialiased", overflowX: "hidden" }}>
      <Navbar />
      <HeroSection />
      <WhyVaxisSection />
      <FeaturesBentoSection />
      <IntegrationsSection />
      <SocialProofSection />
      <CTASection />
      <Footer />
    </div>
  );
}
