import Layout from "@/components/layout/Layout";
import HeroSection from "@/components/landing/HeroSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import AISection from "@/components/landing/AISection";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";

const Index = () => {
  return (
    <Layout>
      <HeroSection />
      <FeaturesSection />
      <AISection />
      <CTASection />
      <Footer />
    </Layout>
  );
};

export default Index;
