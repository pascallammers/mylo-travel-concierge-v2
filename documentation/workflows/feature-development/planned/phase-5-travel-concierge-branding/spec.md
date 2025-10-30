# Phase 5: Travel Concierge Branding & UI/UX Polish

> ### 📍 Current Status: `PLANNED`
> **Location:** `/planned/phase-5-travel-concierge-branding/`
> **Last Updated:** 2025-01-29

**Priority:** 🟢 Medium
**Estimated Effort:** Medium (2-3 days)
**Prerequisites:** 
- ✅ Phase 1-4 completed
- ✅ Core functionality working

## Overview
Transformation der Scira App in den Mylo Travel Concierge mit Travel-spezifischem Branding, optimierter UX für Travel Queries, Custom Instructions für Travel Context, und Search Groups speziell für Travel Use Cases.

**Hauptfeature:** Branded Travel-First Experience

## Problem Statement
**Current Situation:**
- Generic "Scira" Branding
- Search interface nicht Travel-optimiert
- System Prompts generic
- Keine Travel-specific Onboarding

**Desired State:**
- "Mylo Travel Concierge" Brand Identity
- Travel-focused Landing Page
- Quick Actions für häufige Travel Queries
- Travel-optimierte Search Groups
- Onboarding für Miles & Points Neulinge

## Technical Design

### Branding Changes

#### Color Scheme
```css
/* Travel-inspired palette */
--primary: #0066CC;        /* Sky blue */
--secondary: #FF6B35;      /* Sunset orange */
--accent: #00A86B;         /* Jade green (luxury) */
--neutral: #2D3748;        /* Charcoal */
```

#### Typography
- Headings: Inter or Poppins (modern, clean)
- Body: System fonts (performance)

### File Structure

```
app/
├── (landing)/
│   └── page.tsx                # New landing page
│
components/
├── travel/
│   ├── quick-actions.tsx       # Travel quick actions
│   ├── search-categories.tsx   # Award/Cash/Hotels tabs
│   ├── onboarding-tour.tsx     # First-time user tour
│   └── loyalty-programs-picker.tsx
│
public/
├── logo-mylo.svg
├── og-image-travel.png
└── favicon-travel.ico
```

### Implementation Details

#### 1. Landing Page Redesign

**File:** `app/(landing)/page.tsx`

```typescript
import { QuickActions } from '@/components/travel/quick-actions';
import { SearchCategories } from '@/components/travel/search-categories';

export default function TravelLandingPage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="pt-20 pb-12 px-4 text-center">
        <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-orange-500 bg-clip-text text-transparent">
          Mylo Travel Concierge
        </h1>
        <p className="text-xl text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto">
          Your AI expert for award travel, miles optimization, and luxury upgrades
        </p>
        
        <div className="mt-8 flex gap-4 justify-center">
          <Badge variant="secondary">
            🎯 Find Award Availability
          </Badge>
          <Badge variant="secondary">
            💎 Business Class Upgrades
          </Badge>
          <Badge variant="secondary">
            🔄 Transfer Partners
          </Badge>
        </div>
      </section>
      
      {/* Quick Actions */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-semibold mb-6">What would you like to do?</h2>
        <QuickActions />
      </section>
      
      {/* Search Interface */}
      <section className="max-w-4xl mx-auto px-4 py-12">
        <SearchCategories />
      </section>
      
      {/* Features Grid */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">
          Your Personal Award Travel Expert
        </h2>
        
        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard
            icon="🔍"
            title="Award Search"
            description="Search Seats.Aero across programs to find available award seats"
          />
          <FeatureCard
            icon="💰"
            title="Value Calculator"
            description="Calculate cents-per-mile to ensure you're getting great value"
          />
          <FeatureCard
            icon="🎯"
            title="Sweet Spots"
            description="Discover the best redemptions and transfer strategies"
          />
          <FeatureCard
            icon="✈️"
            title="Flight Search"
            description="Compare cash prices vs award availability side-by-side"
          />
          <FeatureCard
            icon="🔄"
            title="Transfer Optimizer"
            description="Find the best way to transfer credit card points"
          />
          <FeatureCard
            icon="🗺️"
            title="Route Planning"
            description="Multi-city routing, stopovers, and alliance strategies"
          />
        </div>
      </section>
      
      {/* CTA */}
      <section className="max-w-4xl mx-auto px-4 py-16 text-center">
        <Card className="p-12 bg-gradient-to-br from-blue-50 to-orange-50 dark:from-blue-950 dark:to-orange-950">
          <h2 className="text-3xl font-bold mb-4">
            Ready to maximize your miles?
          </h2>
          <p className="text-lg text-neutral-600 dark:text-neutral-400 mb-8">
            Start chatting with Mylo and discover amazing award travel opportunities
          </p>
          <Button size="lg" asChild>
            <Link href="/chat">
              Start Planning Your Trip
            </Link>
          </Button>
        </Card>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, description }: any) {
  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {description}
      </p>
    </Card>
  );
}
```

#### 2. Quick Actions Component

**File:** `components/travel/quick-actions.tsx`

```typescript
'use client';

import { Card } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { Plane, Award, Calculator, MapPin, TrendingUp, Search } from 'lucide-react';

export function QuickActions() {
  const router = useRouter();
  
  const actions = [
    {
      icon: Search,
      label: 'Find Award Flights',
      prompt: 'Show me business class award availability from JFK to Tokyo',
      group: 'travel',
    },
    {
      icon: Calculator,
      label: 'Calculate Value',
      prompt: 'Is 75,000 miles for $3,000 business class ticket worth it?',
      group: 'travel',
    },
    {
      icon: TrendingUp,
      label: 'Best Sweet Spots',
      prompt: 'What are the best uses of my miles for Europe business class?',
      group: 'travel',
    },
    {
      icon: Award,
      label: 'Transfer Optimizer',
      prompt: 'I have 100k Amex points, where should I transfer for Asia?',
      group: 'travel',
    },
    {
      icon: Plane,
      label: 'Compare Prices',
      prompt: 'Compare cash price vs miles for flights from LAX to London',
      group: 'travel',
    },
    {
      icon: MapPin,
      label: 'Multi-City Route',
      prompt: 'Help me plan a round-the-world trip with miles',
      group: 'travel',
    },
  ];
  
  const handleQuickAction = (prompt: string, group: string) => {
    // Create new chat with pre-filled prompt
    router.push(`/chat/new?prompt=${encodeURIComponent(prompt)}&group=${group}`);
  };
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {actions.map((action) => (
        <Card
          key={action.label}
          className="p-4 cursor-pointer hover:shadow-lg hover:scale-105 transition-all"
          onClick={() => handleQuickAction(action.prompt, action.group)}
        >
          <action.icon className="w-8 h-8 mb-3 text-blue-600" />
          <h3 className="font-medium text-sm">{action.label}</h3>
        </Card>
      ))}
    </div>
  );
}
```

#### 3. Search Categories

**File:** `components/travel/search-categories.tsx`

```typescript
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Award, DollarSign, Hotel } from 'lucide-react';
import { ChatInput } from '@/components/chat-input';

export function SearchCategories() {
  return (
    <Card className="p-6">
      <Tabs defaultValue="award" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="award" className="gap-2">
            <Award className="w-4 h-4" />
            Award Flights
          </TabsTrigger>
          <TabsTrigger value="cash" className="gap-2">
            <DollarSign className="w-4 h-4" />
            Cash Flights
          </TabsTrigger>
          <TabsTrigger value="hotels" className="gap-2">
            <Hotel className="w-4 h-4" />
            Hotels & More
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="award">
          <div className="space-y-4">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Search for flights bookable with miles/points
            </p>
            <ChatInput
              placeholder="e.g., Business class from NYC to Tokyo in September using Aeroplan"
              group="travel"
            />
            <div className="text-xs text-neutral-500">
              💡 Tip: Specify dates, cabin class, and preferred programs for best results
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="cash">
          <div className="space-y-4">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Search for flights with cash prices
            </p>
            <ChatInput
              placeholder="e.g., Cheapest flights from LAX to Paris next month"
              group="travel"
            />
            <div className="text-xs text-neutral-500">
              💡 Tip: I can compare cash vs award prices to help you decide
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="hotels">
          <div className="space-y-4">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Hotels, car rentals, and travel planning
            </p>
            <ChatInput
              placeholder="e.g., Best hotels in Tokyo using Hilton points"
              group="travel"
            />
            <div className="text-xs text-neutral-500">
              💡 Coming soon: Enhanced hotel and car rental search
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
```

#### 4. Onboarding Tour

**File:** `components/travel/onboarding-tour.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

export function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  
  useEffect(() => {
    // Check if user has seen onboarding
    const hasSeenOnboarding = localStorage.getItem('mylo-onboarding-seen');
    if (!hasSeenOnboarding) {
      setOpen(true);
    }
  }, []);
  
  const steps = [
    {
      title: 'Welcome to Mylo Travel Concierge! ✈️',
      content: (
        <div className="space-y-4">
          <p>I'm Mylo, your AI expert for award travel and miles optimization.</p>
          <p>Let me show you around...</p>
        </div>
      ),
    },
    {
      title: 'What I Can Do',
      content: (
        <ul className="space-y-3">
          <li>🔍 Search award flight availability across programs</li>
          <li>💰 Calculate if redemptions are worth it (cents per mile)</li>
          <li>🎯 Find sweet spots and best value redemptions</li>
          <li>🔄 Optimize credit card point transfers</li>
          <li>✈️ Compare cash prices vs award bookings</li>
        </ul>
      ),
    },
    {
      title: 'How to Get Started',
      content: (
        <div className="space-y-4">
          <p>Just ask me naturally, like:</p>
          <ul className="space-y-2 text-sm bg-neutral-100 dark:bg-neutral-800 p-4 rounded">
            <li>"Find business class to Tokyo with Aeroplan"</li>
            <li>"Is 75k miles worth it for this flight?"</li>
            <li>"Where should I transfer my Amex points?"</li>
          </ul>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            I understand context and can help refine your search!
          </p>
        </div>
      ),
    },
    {
      title: 'Pro Tips 💡',
      content: (
        <ul className="space-y-3 text-sm">
          <li>✓ Be specific with dates and cabin class for best results</li>
          <li>✓ Mention your loyalty programs if you have preferences</li>
          <li>✓ Ask follow-up questions - I remember our conversation</li>
          <li>✓ Use "Compare cash vs miles" for booking decisions</li>
        </ul>
      ),
    },
  ];
  
  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem('mylo-onboarding-seen', 'true');
    }
    setOpen(false);
  };
  
  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      handleClose();
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{steps[step].title}</DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          {steps[step].content}
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="dont-show"
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(checked as boolean)}
            />
            <label htmlFor="dont-show" className="text-sm cursor-pointer">
              Don't show again
            </label>
          </div>
          
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            <Button onClick={handleNext}>
              {step < steps.length - 1 ? 'Next' : 'Get Started'}
            </Button>
          </div>
        </div>
        
        <div className="flex gap-1 justify-center">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 w-8 rounded-full ${
                i === step ? 'bg-blue-600' : 'bg-neutral-300 dark:bg-neutral-700'
              }`}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

#### 5. System Prompt Updates

**File:** `app/actions.ts` - Enhanced Travel Group

```typescript
case 'travel':
  return {
    tools: [...all travel tools...],
    instructions: `You are Mylo, an expert AI Travel Concierge specializing in:

🎯 CORE EXPERTISE:
- Award flight availability search (Seats.Aero)
- Miles and points optimization
- Business and First class upgrades
- Loyalty program strategies
- Transfer partner recommendations
- Sweet spot redemptions

💬 COMMUNICATION STYLE:
- Friendly, enthusiastic, and knowledgeable
- Use emojis sparingly but effectively (✈️ 💎 🎯)
- Explain complex concepts simply
- Always provide context for recommendations
- Celebrate good finds ("That's an excellent redemption!")

🔍 SEARCH STRATEGY:
When user asks about flights:
1. Clarify requirements (dates, origin, destination, cabin)
2. Ask about loyalty program preferences
3. Use appropriate tool (seats_aero_search for awards, search_flights for cash)
4. Calculate redemption value when possible
5. Suggest alternatives if availability is limited

📊 VALUE GUIDANCE:
- Always explain "cents per mile" when relevant
- Benchmark: Economy 1¢, Premium Economy 1.3¢, Business 1.5-2¢, First 2+¢
- Recommend cash booking if redemption value is poor (<1¢)
- Highlight sweet spots and exceptional values

🎯 PROACTIVE SUGGESTIONS:
- Mention transfer bonuses when relevant
- Suggest flexible dates for better availability
- Recommend stopovers when allowed
- Point out alliance benefits
- Share insider tips about specific programs

⚠️ IMPORTANT DISCLAIMERS:
- Award availability changes rapidly
- Prices and miles required may vary
- Always verify on airline website before booking
- Tax/fees separate from miles cost

Today's date: ${new Date().toISOString().split('T')[0]}
Current time: ${new Date().toISOString()}

Remember: Your goal is to help users maximize their miles and find amazing travel experiences!`,
  };
```

#### 6. Metadata & Branding

**File:** `app/layout.tsx`

```typescript
export const metadata: Metadata = {
  title: 'Mylo Travel Concierge - AI Award Travel Expert',
  description: 'Your AI assistant for award flights, miles optimization, and luxury travel upgrades. Find the best redemptions and maximize your points.',
  keywords: [
    'award travel',
    'miles and points',
    'business class',
    'first class',
    'travel hacking',
    'Aeroplan',
    'loyalty programs',
    'flight deals',
  ],
  openGraph: {
    title: 'Mylo Travel Concierge',
    description: 'Find award flights and maximize your miles with AI',
    images: ['/og-image-travel.png'],
  },
};
```

**File:** `package.json` (Update name)

```json
{
  "name": "mylo-travel-concierge-v2",
  "description": "AI-powered travel concierge for award flights and miles optimization"
}
```

## Functional Requirements
- [ ] Landing page mit Travel-Focus
- [ ] Quick Actions für häufige Queries
- [ ] Search Categories (Award/Cash/Hotels)
- [ ] Onboarding Tour für neue User
- [ ] Updated Branding (Logo, Colors, Copy)
- [ ] Travel-optimierte System Prompts
- [ ] Meta Tags für SEO
- [ ] Responsive Design

## Non-Functional Requirements
- [ ] Landing Page lädt < 2s
- [ ] Smooth transitions zwischen Sections
- [ ] Mobile-optimized
- [ ] Accessible (WCAG 2.1 AA)
- [ ] SEO-friendly

## Success Criteria
✅ **Branding:**
- Mylo branding consistent überall
- Travel-specific color scheme
- Professional Logo

✅ **UX:**
- Clear value proposition auf Landing Page
- Quick Actions funktionieren
- Onboarding hilft neuen Usern
- Search flow intuitiv

✅ **Technical:**
- Keine Breaking Changes
- Performance nicht beeinträchtigt
- Mobile fully functional

## Testing Checklist
- [ ] Landing Page desktop
- [ ] Landing Page mobile
- [ ] Quick Actions starten Chats korrekt
- [ ] Search Categories mit richtigem Group
- [ ] Onboarding zeigt sich bei First Visit
- [ ] Onboarding "Don't show again" funktioniert
- [ ] System Prompts generieren gute Responses
- [ ] Meta Tags korrekt
- [ ] Logo/Favicon angezeigt

## Dependencies
- ✅ Phase 1-4 Features functional
- ⚠️  Logo Design (kann Placeholder sein)
- ⚠️  OG Image für Social Sharing

## Risks & Mitigation
- **Risk:** Branding zu generisch
- **Mitigation:** User Feedback, Iteration

- **Risk:** Onboarding nervt Power Users
- **Mitigation:** "Don't show again", Skip option

## Timeline Estimate
- Landing Page: 1 day
- Components (Quick Actions, Categories): 0.5 day
- Onboarding Tour: 0.5 day
- System Prompt Updates: 0.5 day
- Branding Assets: 0.5 day
- Testing & Polish: 0.5 day
**Total: 2-3 days**

## Deliverables
1. ✅ New Landing Page
2. ✅ Quick Actions Component
3. ✅ Search Categories Component
4. ✅ Onboarding Tour
5. ✅ Updated System Prompts
6. ✅ Branding Assets (Logo, Colors)
7. ✅ Meta Tags & SEO
8. ✅ Documentation

## Optional Enhancements (Post-Launch)
- User profiles (save loyalty programs)
- Favorite routes
- Price alerts
- Trip planning workspace
- Share search results
- Export itineraries

## Next Steps
Nach Completion:
→ **Launch!** 🚀
→ User Feedback Collection
→ Iterative Improvements
→ Community Building

## References
- [Landing Page Best Practices](https://www.nngroup.com/articles/landing-page-design/)
- [Travel Website UX](https://baymard.com/blog/travel-site-ux)
- → Related: [All Previous Phases](../)
