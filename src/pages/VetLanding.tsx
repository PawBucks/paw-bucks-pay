import { useNavigate } from"react-router-dom";
import { SEO } from"@/components/SEO";
import { seoMeta } from"@/lib/seoMeta";
import { Button } from"@/components/ui/button";
import { Card } from"@/components/ui/card";
import { 
 Stethoscope, 
 FileText, 
 Sparkles, 
 Shield, 
 TrendingUp, 
 Wallet, 
 Heart, 
 ArrowRight, 
 CheckCircle, 
 Brain, 
 Pill, 
 Users, 
 Clock, 
 DollarSign,
 Bell,
 Share2,
 BarChart3,
 Zap,
 MessageSquare,
 CalendarCheck
} from"lucide-react";
import { SocialFollowLinks } from"@/components/SocialFollowLinks";
import { PremiumMerchantsBanner } from"@/components/PremiumMerchantsBanner";
import logo from"@/assets/logo.png";
import vetClinicHero from"@/assets/vet-clinic-hero.png";
import vetTeamHero from"@/assets/vet-team-hero.jpeg";
import vetConsultationHero from"@/assets/vet-consultation-hero.png";

const VetLanding = () => {
 const navigate = useNavigate();

 const features = [
 {
 icon: FileText,
 title:"Complete EMR System",
 description:"Digital patient records, SOAP notes with vitals tracking, lab & imaging management, and surgical documentation.",
 color:"primary"
 },
 {
 icon: Sparkles,
 title:"AI Clinical Assistant",
 description:"Voice-to-SOAP transcription, symptom triage scoring, and diagnostic imaging overlays powered by AI.",
 color:"accent"
 },
 {
 icon: Shield,
 title:"Insurance Claim-Splicing",
 description:"Automatically split invoices between insurance coverage and owner co-pays. Owners pay only what they owe.",
 color:"secondary"
 },
 {
 icon: Heart,
 title:"Wellness Plan Architect",
 description:"Build recurring revenue plans ($50/mo for vaccines + exams). Owners earn 10x-30x PawBucks rewards.",
 color:"primary"
 },
 {
 icon: TrendingUp,
 title:"The'Gap Filler' Tool",
 description:"Identify overdue patients and send targeted PawBucks bonus offers to bring them back.",
 color:"accent"
 },
 {
 icon: Pill,
 title:"Prescription Fulfillment",
 description:"Keep pharmacy revenue in-house. Approve scripts that ship from PawBucks Store — you keep the margin.",
 color:"secondary"
 }
 ];

 const benefits = [
 {
 icon: DollarSign,
 title:"Increase Revenue",
 description:"Wellness plans, prescription margins, and reduced no-shows through automated reminders."
 },
 {
 icon: Clock,
 title:"Save Time",
 description:"AI-powered SOAP notes, automated insurance processing, and streamlined workflows."
 },
 {
 icon: Users,
 title:"Retain Patients",
 description:"PawBucks rewards keep pet owners coming back. Gap analysis ensures no patient falls through the cracks."
 },
 {
 icon: Share2,
 title:"Care Network",
 description:"Share relevant medical notes with trainers, groomers, and other pet merchants in the ecosystem."
 }
 ];

 return (
 <>
 <SEO 
 title={seoMeta.vets.title}
 description={seoMeta.vets.description}
 keywords={[...seoMeta.vets.keywords]}
 canonical={seoMeta.vets.canonical}
 />
 <div className="min-h-screen bg-[var(--gradient-hero)] overflow-hidden">
 {/* Header */}
 <header className="border-b bg-card/80 backdrop-blur-lg sticky top-0 z-50 shadow-sm safe-area-inset-top">
 <nav className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
 <div 
 className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
 onClick={() => navigate("/")}
 role="button"
 tabIndex={0}
 onKeyDown={(e) => e.key ==='Enter' && navigate("/")}
 >
 <img 
 src={logo} 
 alt="PawBucks Logo" 
 className="h-24 sm:h-32 w-auto object-contain"
 />
 </div>
 <div className="flex items-center gap-4">
 <Button 
 onClick={() => navigate("/auth?role=vet")}
 className="shadow-xl hover:shadow-2xl transition-all hover:scale-105"
 >
 Sign In
 </Button>
 </div>
 </nav>
 </header>

 <main>
 {/* Hero Section */}
 <section className="relative container mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-32">
 <div className="absolute top-20 right-10 w-72 h-72 bg-accent/20 rounded-full blur-3xl animate-pulse" aria-hidden="true"></div>
 <div className="absolute bottom-20 left-10 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse delay-700" aria-hidden="true"></div>
 
 <div className="relative max-w-5xl mx-auto text-center space-y-8 animate-fade-in">
 <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-medium mb-4">
 <Stethoscope className="w-5 h-5" />
 Built for Veterinary Practices
 </div>
 
 <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-tight tracking-tight text-foreground">
 Practice Smarter,
 <br />
 <span className="text-accent">
 Not Harder
 </span>
 </h1>
 
 <p className="text-xl sm:text-2xl lg:text-3xl text-foreground/90 max-w-3xl mx-auto leading-relaxed font-medium">
 EMR, AI tools, insurance automation, and practice growth — 
 all in one platform with PawBucks rewards built in.
 </p>

 <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
 Stop losing revenue to missed appointments and online pharmacies. 
 The PawBucks Vet Portal helps you retain patients, streamline workflows, 
 and build recurring revenue — while your clients earn rewards they love.
 </p>
 
 <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
 <Button 
 size="lg" 
 onClick={() => navigate("/vet-onboarding")}
 className="text-base sm:text-lg px-8 sm:px-10 py-6 sm:py-7 shadow-xl hover:shadow-2xl transition-all hover:scale-105 group"
 >
 Sign Up as a Veterinarian
 <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
 </Button>
 <Button 
 size="lg" 
 variant="outline"
 onClick={() => document.getElementById('features')?.scrollIntoView({ behavior:'smooth' })}
 className="text-base sm:text-lg px-8 sm:px-10 py-6 sm:py-7"
 >
 See Features
 </Button>
 </div>
 </div>
 </section>

 {/* Stats Section */}
 <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
 <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
 <div className="text-center p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50">
 <p className="text-3xl sm:text-4xl font-bold text-primary">10x-30x</p>
 <p className="text-muted-foreground mt-1">PawBucks Rewards</p>
 </div>
 <div className="text-center p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50">
 <p className="text-3xl sm:text-4xl font-bold text-accent">AI</p>
 <p className="text-muted-foreground mt-1">Clinical Assistant</p>
 </div>
 <div className="text-center p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50">
 <p className="text-3xl sm:text-4xl font-bold text-secondary">Auto</p>
 <p className="text-muted-foreground mt-1">Insurance Claims</p>
 </div>
 <div className="text-center p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50">
 <p className="text-3xl sm:text-4xl font-bold text-primary">$0</p>
 <p className="text-muted-foreground mt-1">Setup Fee</p>
 </div>
 </div>
 </section>

 {/* Vet Lifestyle Hero Image Section */}
 <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
 <div className="relative max-w-5xl mx-auto">
 <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-br from-muted/50 to-muted">
 <img 
 src={vetClinicHero}
 alt="Veterinarian with pets in a modern clinic setting"
 className="w-full h-auto object-contain"
 />
 <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent pointer-events-none" />
 <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 lg:p-10">
 <p className="text-lg sm:text-xl lg:text-2xl font-semibold text-foreground max-w-lg drop-shadow-sm">
 Trusted by veterinary practices delivering exceptional pet care.
 </p>
 </div>
 </div>
 </div>
 </section>

 {/* Premium Merchants Carousel */}
 <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
 <PremiumMerchantsBanner 
 title="Premium Partners in the PawBucks Network"
 rotationInterval={5000}
 showMultiple={true}
 />
 </section>

 {/* Core Features Section */}
 <section
 id="features"
 className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-28"
 >
 <div className="text-center mb-12 sm:mb-16 animate-fade-in">
 <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
 Everything Your Practice Needs
 </h2>
 <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
 From clinical workflows to revenue optimization — one integrated platform.
 </p>
 </div>

 <div className="grid gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
 {features.map((feature, index) => (
 <Card 
 key={index} 
 className="group p-8 hover:scale-105 transition-all duration-300 hover:shadow-2xl border-2"
 >
 <div className={`w-16 h-16 rounded-2xl bg-${feature.color}/10 flex items-center justify-center mb-6 shadow-md group-hover:scale-110 group-hover:bg-${feature.color}/20 transition-all`}>
 <feature.icon className={`w-8 h-8 text-${feature.color}`} />
 </div>
 <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
 <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
 </Card>
 ))}
 </div>
 </section>

 {/* AI Section */}
 <section className="relative bg-gradient-to-br from-accent/5 to-primary/5 py-16 sm:py-20 lg:py-28">
 <div className="container mx-auto px-4 sm:px-6 lg:px-8">
 <div className="max-w-6xl mx-auto">
 <div className="grid lg:grid-cols-2 gap-12 items-center">
 <div>
 <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent font-medium mb-6">
 <Brain className="w-5 h-5" />
 AI-Powered
 </div>
 <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
 Your Smart Clinical Assistant
 </h2>
 <p className="text-xl text-muted-foreground mb-8">
 Reduce documentation time by up to 50% with AI that understands veterinary medicine.
 </p>
 <ul className="space-y-4">
 <li className="flex items-start gap-4">
 <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
 <MessageSquare className="w-5 h-5 text-accent" />
 </div>
 <div>
 <h4 className="font-bold">Voice-to-SOAP Notes</h4>
 <p className="text-muted-foreground">Dictate exams naturally. AI structures into proper SOAP format.</p>
 </div>
 </li>
 <li className="flex items-start gap-4">
 <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
 <Zap className="w-5 h-5 text-primary" />
 </div>
 <div>
 <h4 className="font-bold">Symptom Triage Scoring</h4>
 <p className="text-muted-foreground">AI analyzes owner-reported symptoms and suggests urgency levels.</p>
 </div>
 </li>
 <li className="flex items-start gap-4">
 <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center flex-shrink-0">
 <BarChart3 className="w-5 h-5 text-secondary" />
 </div>
 <div>
 <h4 className="font-bold">Diagnostic Overlays</h4>
 <p className="text-muted-foreground">Upload X-rays and ultrasounds for AI-assisted anomaly detection.</p>
 </div>
 </li>
 </ul>
 </div>
 <div className="relative">
 <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-primary/20 rounded-3xl blur-3xl"></div>
 <Card className="relative p-8 space-y-6 border-2">
 <div className="flex items-center gap-3">
 <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
 <Sparkles className="w-6 h-6 text-accent" />
 </div>
 <div>
 <h4 className="font-bold">AI SOAP Draft</h4>
 <p className="text-sm text-muted-foreground">Generated in 3.2 seconds</p>
 </div>
 </div>
 <div className="space-y-3 text-sm">
 <div className="p-3 rounded-lg bg-muted/50">
 <p className="font-semibold text-primary">Subjective:</p>
 <p className="text-muted-foreground">Owner reports decreased appetite x3 days, lethargy...</p>
 </div>
 <div className="p-3 rounded-lg bg-muted/50">
 <p className="font-semibold text-accent">Objective:</p>
 <p className="text-muted-foreground">T: 102.8°F, HR: 120, RR: 24, BCS: 5/9...</p>
 </div>
 <div className="p-3 rounded-lg bg-muted/50">
 <p className="font-semibold text-secondary">Assessment:</p>
 <p className="text-muted-foreground">R/O gastroenteritis, pancreatitis, dietary indiscretion...</p>
 </div>
 </div>
 <Button 
 className="w-full" 
 size="sm"
 onClick={() => navigate("/vet-onboarding")}
 >
 <CheckCircle className="w-4 h-4 mr-2" />
 Apply to Record
 </Button>
 </Card>
 </div>
 </div>
 </div>
 </div>
 </section>

 {/* Vet Consultation Lifestyle Section */}
 <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-28">
 <div className="max-w-5xl mx-auto">
 <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
 {/* Image Container */}
 <div className="relative rounded-3xl overflow-hidden shadow-2xl order-2 lg:order-1">
 <img 
 src={vetConsultationHero} 
 alt="Veterinarian consulting with pet owner about their pet's care"
 className="w-full h-auto object-contain"
 />
 <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent pointer-events-none" />
 </div>
 
 {/* Text Content */}
 <div className="order-1 lg:order-2">
 <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-medium mb-6">
 <Heart className="w-5 h-5" />
 Client Care
 </div>
 <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
 Build Lasting Client Relationships
 </h2>
 <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
 Empower pet owners with transparent care plans and seamless communication — creating trust that keeps families coming back for generations.
 </p>
 <ul className="space-y-4">
 <li className="flex items-center gap-3">
 <CheckCircle className="w-6 h-6 text-primary flex-shrink-0" />
 <span className="text-muted-foreground">Clear treatment explanations and cost breakdowns</span>
 </li>
 <li className="flex items-center gap-3">
 <CheckCircle className="w-6 h-6 text-primary flex-shrink-0" />
 <span className="text-muted-foreground">Automated follow-up reminders and care instructions</span>
 </li>
 <li className="flex items-center gap-3">
 <CheckCircle className="w-6 h-6 text-primary flex-shrink-0" />
 <span className="text-muted-foreground">PawBucks rewards that incentivize preventive care</span>
 </li>
 </ul>
 </div>
 </div>
 </div>
 </section>

 {/* Financial Friction Section */}
 <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-28">
 <div className="max-w-6xl mx-auto">
 <div className="text-center mb-12">
 <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-medium mb-6">
 <Wallet className="w-5 h-5" />
 Financial Tools
 </div>
 <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
 Remove Payment Friction
 </h2>
 <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
 Make it easy for pet owners to say yes to care.
 </p>
 </div>

 <div className="grid md:grid-cols-2 gap-8">
 <Card className="p-8 border-2 hover:shadow-xl transition-all">
 <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
 <Shield className="w-8 h-8 text-primary" />
 </div>
 <h3 className="text-2xl font-bold mb-4">Insurance Claim-Splicing</h3>
 <p className="text-muted-foreground mb-6">
 When an owner pays via PawBucks, we automatically calculate coverage based on their policy. 
 The claim goes to insurance, and the owner only pays their co-pay at checkout.
 </p>
 <ul className="space-y-3">
 <li className="flex items-center gap-3">
 <CheckCircle className="w-5 h-5 text-primary" />
 <span>Automatic deductible calculation</span>
 </li>
 <li className="flex items-center gap-3">
 <CheckCircle className="w-5 h-5 text-primary" />
 <span>Real-time coverage estimation</span>
 </li>
 <li className="flex items-center gap-3">
 <CheckCircle className="w-5 h-5 text-primary" />
 <span>Major insurers supported</span>
 </li>
 </ul>
 </Card>

 <Card className="p-8 border-2 hover:shadow-xl transition-all">
 <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-6">
 <Heart className="w-8 h-8 text-accent" />
 </div>
 <h3 className="text-2xl font-bold mb-4">Wellness Plan Architect</h3>
 <p className="text-muted-foreground mb-6">
 Build custom subscription plans for preventive care. Owners pay monthly, 
 earn 10x-30x PawBucks rewards, and you get predictable recurring revenue.
 </p>
 <ul className="space-y-3">
 <li className="flex items-center gap-3">
 <CheckCircle className="w-5 h-5 text-accent" />
 <span>Customize included services</span>
 </li>
 <li className="flex items-center gap-3">
 <CheckCircle className="w-5 h-5 text-accent" />
 <span>Automated billing via Stripe</span>
 </li>
 <li className="flex items-center gap-3">
 <CheckCircle className="w-5 h-5 text-accent" />
 <span>Owners earn PawBucks rewards</span>
 </li>
 </ul>
 </Card>
 </div>
 </div>
 </section>

 {/* Practice Growth Section */}
 <section className="relative bg-gradient-to-br from-primary/5 to-secondary/5 py-16 sm:py-20 lg:py-28">
 <div className="container mx-auto px-4 sm:px-6 lg:px-8">
 <div className="max-w-6xl mx-auto">
 <div className="text-center mb-12">
 <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/10 text-secondary font-medium mb-6">
 <TrendingUp className="w-5 h-5" />
 Practice Growth
 </div>
 <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
 Stop Losing Revenue
 </h2>
 <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
 Recapture missed appointments and pharmacy revenue.
 </p>
 </div>

 <div className="grid md:grid-cols-2 gap-8">
 <Card className="p-8 border-2 hover:shadow-xl transition-all">
 <div className="w-16 h-16 rounded-2xl bg-secondary/10 flex items-center justify-center mb-6">
 <CalendarCheck className="w-8 h-8 text-secondary" />
 </div>
 <h3 className="text-2xl font-bold mb-4">The"Gap Filler" Tool</h3>
 <p className="text-muted-foreground mb-6">
 Analytics identify which patients are overdue for dentals, vaccines, or check-ups. 
 Send targeted PawBucks bonus offers to bring them back.
 </p>
 <div className="p-4 rounded-xl bg-muted/50">
 <p className="text-sm font-medium mb-2">Example Campaign:</p>
 <p className="text-muted-foreground text-sm">
"15 patients overdue for dental cleaning → Send 500 bonus PawBucks offer → 
 7 appointments booked within 48 hours"
 </p>
 </div>
 </Card>

 <Card className="p-8 border-2 hover:shadow-xl transition-all">
 <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
 <Pill className="w-8 h-8 text-primary" />
 </div>
 <h3 className="text-2xl font-bold mb-4">Prescription Fulfillment Engine</h3>
 <p className="text-muted-foreground mb-6">
 Stop losing pharmacy revenue to Chewy. Approve prescriptions in the portal 
 that ship from our PawBucks Store — you keep 10-25% margin.
 </p>
 <div className="p-4 rounded-xl bg-muted/50">
 <p className="text-sm font-medium mb-2">Your Revenue Share:</p>
 <p className="text-muted-foreground text-sm">
 Apoquel 16mg (30ct) @ $85.99 → You earn $12.90 (15% margin)
 </p>
 </div>
 </Card>
 </div>
 </div>
 </div>
 </section>

 {/* Benefits Section */}
 <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-28">
 <div className="max-w-6xl mx-auto">
 <div className="text-center mb-12">
 <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
 Why Vets Choose PawBucks
 </h2>
 </div>

 <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
 {benefits.map((benefit, index) => (
 <div key={index} className="text-center p-6 rounded-2xl bg-card border border-border/50 hover:shadow-lg transition-all">
 <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
 <benefit.icon className="w-7 h-7 text-primary" />
 </div>
 <h3 className="font-bold text-lg mb-2">{benefit.title}</h3>
 <p className="text-muted-foreground text-sm">{benefit.description}</p>
 </div>
 ))}
 </div>
 </div>
 </section>

 {/* Vet Team Lifestyle Section */}
 <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-28">
 <div className="max-w-6xl mx-auto">
 <div className="text-center mb-10">
 <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
 Join a Community of Caring Professionals
 </h2>
 <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto">
 Partner with thousands of veterinary teams who trust PawBucks to grow their practice while delivering exceptional pet care.
 </p>
 </div>
 
 {/* Lifestyle Image Container */}
 <div className="relative rounded-3xl overflow-hidden shadow-2xl">
 <img 
 src={vetTeamHero} 
 alt="Professional veterinary team with a husky puppy in front of their animal hospital"
 className="w-full h-auto object-contain"
 />
 {/* Subtle gradient overlay for polish */}
 <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
 </div>
 </div>
 </section>

 {/* CTA Section */}
 <section className="relative bg-gradient-to-br from-accent/10 to-primary/10 py-16 sm:py-20 lg:py-28">
 <div className="container mx-auto px-4 sm:px-6 lg:px-8">
 <div className="max-w-3xl mx-auto text-center">
 <Stethoscope className="w-16 h-16 text-primary mx-auto mb-6" />
 <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
 Ready to Transform Your Practice?
 </h2>
 <p className="text-xl text-muted-foreground mb-8">
 Join the network of forward-thinking veterinarians using PawBucks 
 to grow their practice and delight their clients.
 </p>
 <div className="flex flex-col sm:flex-row gap-4 justify-center">
 <Button 
 size="lg" 
 onClick={() => navigate("/vet-onboarding")}
 className="text-lg px-10 py-7 shadow-xl hover:shadow-2xl transition-all hover:scale-105 group"
 >
 Get Started Free
 <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
 </Button>
 </div>
 <p className="text-sm text-muted-foreground mt-6">
 No setup fees • No long-term contracts • Cancel anytime
 </p>
 </div>
 </div>
 </section>
 </main>

 {/* Footer */}
 <footer className="border-t py-12 sm:py-16 bg-card/80 backdrop-blur-sm" role="contentinfo">
 <div className="container mx-auto px-4 sm:px-6 lg:px-8">
 <div className="flex flex-col items-center gap-6">
 <img
 src={logo}
 alt="PawBucks Logo"
 className="h-24 sm:h-32 w-auto object-contain"
 />
 <p className="text-sm sm:text-base text-muted-foreground text-center max-w-md">
 Empowering veterinary practices with smart payments, rewards, and growth tools.
 </p>
 <SocialFollowLinks />
 <div className="flex items-center gap-4 text-sm">
 <a 
 href="/" 
 className="text-muted-foreground hover:text-primary transition-colors"
 onClick={(e) => { e.preventDefault(); navigate("/"); }}
 >
 For Pet Owners
 </a>
 <span className="text-muted-foreground/50">•</span>
 <a 
 href="/merchants" 
 className="text-muted-foreground hover:text-primary transition-colors"
 onClick={(e) => { e.preventDefault(); navigate("/merchants"); }}
 >
 For Merchants
 </a>
 </div>
 <p className="text-sm text-muted-foreground">
 &copy; {new Date().getFullYear()} PawBucks. All rights reserved.
 </p>
 </div>
 </div>
 </footer>
 </div>
 </>
 );
};

export default VetLanding;
