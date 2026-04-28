import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { 
  Home, 
  Calculator, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  Info,
  DollarSign,
  Percent,
  AlertTriangle,
  Building,
  Dog,
  Scissors
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CalculationResult {
  businessPercentage: number;
  annualRentDeduction: number;
  annualUtilitiesDeduction: number;
  totalAnnualDeduction: number;
  monthlyDeduction: number;
  method: 'regular' | 'simplified';
  simplifiedDeduction: number;
  recommendedMethod: 'regular' | 'simplified';
}

export function HomeOfficeCalculator() {
  const [step, setStep] = useState(1);
  const [spaceType, setSpaceType] = useState<'grooming' | 'boarding' | 'office' | 'storage'>('grooming');
  const [businessSqFt, setBusinessSqFt] = useState('');
  const [totalSqFt, setTotalSqFt] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [monthlyUtilities, setMonthlyUtilities] = useState('');
  const [isExclusiveUse, setIsExclusiveUse] = useState<'yes' | 'no' | 'partial'>('yes');
  const [result, setResult] = useState<CalculationResult | null>(null);

  const totalSteps = 4;

  const spaceTypeInfo = {
    grooming: {
      icon: Scissors,
      label: 'Grooming Room',
      description: 'Dedicated space for pet grooming services',
      irsNote: 'Must be used regularly and exclusively for grooming'
    },
    boarding: {
      icon: Dog,
      label: 'Boarding/Kennel Area',
      description: 'Space used to board pets overnight',
      irsNote: 'Storage of pets counts as business use under IRS rules'
    },
    office: {
      icon: Building,
      label: 'Home Office',
      description: 'Administrative work, bookkeeping, client calls',
      irsNote: 'Must be your principal place of business'
    },
    storage: {
      icon: Home,
      label: 'Inventory Storage',
      description: 'Space for storing pet supplies and products',
      irsNote: 'Storage exception: exclusive use not required for inventory'
    }
  };

  const calculateDeduction = () => {
    const business = parseFloat(businessSqFt) || 0;
    const total = parseFloat(totalSqFt) || 0;
    const rent = parseFloat(monthlyRent) || 0;
    const utilities = parseFloat(monthlyUtilities) || 0;

    if (total === 0 || business === 0) {
      return;
    }

    // Calculate percentage
    let businessPercentage = (business / total) * 100;
    
    // Adjust for partial exclusive use
    if (isExclusiveUse === 'partial') {
      businessPercentage = businessPercentage * 0.75; // Conservative estimate
    } else if (isExclusiveUse === 'no' && spaceType !== 'storage') {
      // Non-exclusive use generally not deductible except for storage
      businessPercentage = 0;
    }

    // Cap at 100%
    businessPercentage = Math.min(businessPercentage, 100);

    // Regular method calculations
    const annualRent = rent * 12;
    const annualUtilities = utilities * 12;
    const annualRentDeduction = (annualRent * businessPercentage) / 100;
    const annualUtilitiesDeduction = (annualUtilities * businessPercentage) / 100;
    const totalAnnualDeduction = annualRentDeduction + annualUtilitiesDeduction;

    // Simplified method (IRS allows $5/sq ft, max 300 sq ft = $1,500)
    const simplifiedSqFt = Math.min(business, 300);
    const simplifiedDeduction = simplifiedSqFt * 5;

    const result: CalculationResult = {
      businessPercentage: Math.round(businessPercentage * 100) / 100,
      annualRentDeduction: Math.round(annualRentDeduction * 100) / 100,
      annualUtilitiesDeduction: Math.round(annualUtilitiesDeduction * 100) / 100,
      totalAnnualDeduction: Math.round(totalAnnualDeduction * 100) / 100,
      monthlyDeduction: Math.round((totalAnnualDeduction / 12) * 100) / 100,
      method: 'regular',
      simplifiedDeduction: Math.round(simplifiedDeduction * 100) / 100,
      recommendedMethod: totalAnnualDeduction > simplifiedDeduction ? 'regular' : 'simplified'
    };

    setResult(result);
    setStep(5);
  };

  const resetCalculator = () => {
    setStep(1);
    setSpaceType('grooming');
    setBusinessSqFt('');
    setTotalSqFt('');
    setMonthlyRent('');
    setMonthlyUtilities('');
    setIsExclusiveUse('yes');
    setResult(null);
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return !!spaceType;
      case 2:
        return parseFloat(businessSqFt) > 0 && parseFloat(totalSqFt) > 0 && parseFloat(businessSqFt) <= parseFloat(totalSqFt);
      case 3:
        return parseFloat(monthlyRent) >= 0 || parseFloat(monthlyUtilities) >= 0;
      case 4:
        return !!isExclusiveUse;
      default:
        return true;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Home className="h-5 w-5 text-primary" />
          Home Office & Boarding Space Calculator
        </CardTitle>
        <CardDescription>
          Calculate the percentage of rent and utilities you can deduct for business use of your home
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress indicator */}
        {step <= totalSteps && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Step {step} of {totalSteps}</span>
              <span>{Math.round((step / totalSteps) * 100)}% complete</span>
            </div>
            <Progress value={(step / totalSteps) * 100} className="h-2" />
          </div>
        )}

        {/* Step 1: Space Type */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">What type of space are you deducting?</h3>
            <RadioGroup value={spaceType} onValueChange={(v) => setSpaceType(v as typeof spaceType)}>
              <div className="grid gap-3">
                {(Object.entries(spaceTypeInfo) as [keyof typeof spaceTypeInfo, typeof spaceTypeInfo.grooming][]).map(([key, info]) => {
                  const Icon = info.icon;
                  return (
                    <Label
                      key={key}
                      htmlFor={key}
                      className={`flex items-start gap-4 p-4 border rounded-lg cursor-pointer transition-colors ${
                        spaceType === key ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                      }`}
                    >
                      <RadioGroupItem value={key} id={key} className="mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-primary" />
                          <span className="font-medium">{info.label}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{info.description}</p>
                        <p className="text-xs text-info mt-1 flex items-center gap-1">
                          <Info className="h-3 w-3" />
                          {info.irsNote}
                        </p>
                      </div>
                    </Label>
                  );
                })}
              </div>
            </RadioGroup>
          </div>
        )}

        {/* Step 2: Square Footage */}
        {step === 2 && (
          <div className="space-y-6">
            <h3 className="text-lg font-medium">Enter your space measurements</h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="businessSqFt">
                    Dedicated {spaceTypeInfo[spaceType].label} Square Footage
                  </Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Measure the area used exclusively for your pet business. Include any connected spaces like wash areas or waiting rooms.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="relative">
                  <Input
                    id="businessSqFt"
                    type="number"
                    min="0"
                    placeholder="e.g., 200"
                    value={businessSqFt}
                    onChange={(e) => setBusinessSqFt(e.target.value)}
                    className="pr-12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    sq ft
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="totalSqFt">Total Home Square Footage</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>The total living area of your home. You can usually find this on your lease, property tax records, or real estate listing.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="relative">
                  <Input
                    id="totalSqFt"
                    type="number"
                    min="0"
                    placeholder="e.g., 1500"
                    value={totalSqFt}
                    onChange={(e) => setTotalSqFt(e.target.value)}
                    className="pr-12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    sq ft
                  </span>
                </div>
              </div>

              {businessSqFt && totalSqFt && parseFloat(businessSqFt) > 0 && parseFloat(totalSqFt) > 0 && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Business Use Percentage</span>
                    <span className="text-2xl font-bold text-primary">
                      {((parseFloat(businessSqFt) / parseFloat(totalSqFt)) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}

              {parseFloat(businessSqFt) > parseFloat(totalSqFt) && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Business space cannot exceed total home square footage.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Expenses */}
        {step === 3 && (
          <div className="space-y-6">
            <h3 className="text-lg font-medium">Enter your monthly housing expenses</h3>
            <p className="text-sm text-muted-foreground">
              Include rent/mortgage interest and utilities. We'll calculate the deductible portion.
            </p>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="monthlyRent">Monthly Rent or Mortgage Interest</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="monthlyRent"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={monthlyRent}
                    onChange={(e) => setMonthlyRent(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  For mortgages, only include the interest portion (not principal)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="monthlyUtilities">Monthly Utilities</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="monthlyUtilities"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={monthlyUtilities}
                    onChange={(e) => setMonthlyUtilities(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Include electricity, gas, water, internet, and phone
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Exclusive Use */}
        {step === 4 && (
          <div className="space-y-6">
            <h3 className="text-lg font-medium">Is this space used exclusively for business?</h3>
            <p className="text-sm text-muted-foreground">
              The IRS requires "regular and exclusive use" for most home office deductions. However, there are exceptions for inventory storage and daycare.
            </p>
            
            <RadioGroup value={isExclusiveUse} onValueChange={(v) => setIsExclusiveUse(v as typeof isExclusiveUse)}>
              <div className="space-y-3">
                <Label
                  htmlFor="exclusive-yes"
                  className={`flex items-start gap-4 p-4 border rounded-lg cursor-pointer transition-colors ${
                    isExclusiveUse === 'yes' ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                  }`}
                >
                  <RadioGroupItem value="yes" id="exclusive-yes" className="mt-1" />
                  <div>
                    <span className="font-medium">Yes, 100% exclusive business use</span>
                    <p className="text-sm text-muted-foreground">The space is never used for personal activities</p>
                  </div>
                </Label>

                <Label
                  htmlFor="exclusive-partial"
                  className={`flex items-start gap-4 p-4 border rounded-lg cursor-pointer transition-colors ${
                    isExclusiveUse === 'partial' ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                  }`}
                >
                  <RadioGroupItem value="partial" id="exclusive-partial" className="mt-1" />
                  <div>
                    <span className="font-medium">Mostly business, some personal use</span>
                    <p className="text-sm text-muted-foreground">Occasional personal use when not operating business</p>
                  </div>
                </Label>

                <Label
                  htmlFor="exclusive-no"
                  className={`flex items-start gap-4 p-4 border rounded-lg cursor-pointer transition-colors ${
                    isExclusiveUse === 'no' ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                  }`}
                >
                  <RadioGroupItem value="no" id="exclusive-no" className="mt-1" />
                  <div>
                    <span className="font-medium">No, mixed personal and business use</span>
                    <p className="text-sm text-muted-foreground">Regular personal use alongside business activities</p>
                  </div>
                </Label>
              </div>
            </RadioGroup>

            {isExclusiveUse === 'no' && spaceType !== 'storage' && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Limited Deduction</AlertTitle>
                <AlertDescription>
                  Without exclusive use, this space may not qualify for a home office deduction under IRS rules. 
                  Consider designating a specific area for exclusive business use.
                </AlertDescription>
              </Alert>
            )}

            {spaceType === 'storage' && (
              <Alert className="border-success/30 bg-success/10 text-success">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <AlertTitle>Storage Exception</AlertTitle>
                <AlertDescription>
                  Good news! The IRS allows deductions for inventory storage space even without exclusive use, 
                  as long as you have no other fixed location for your business.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Step 5: Results */}
        {step === 5 && result && (
          <div className="space-y-6">
            <div className="text-center pb-4 border-b">
              <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-3" />
              <h3 className="text-xl font-bold">Your Deduction Estimate</h3>
              <p className="text-muted-foreground">Based on your {spaceTypeInfo[spaceType].label.toLowerCase()}</p>
            </div>

            {/* Main Result */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className={`${result.recommendedMethod === 'regular' ? 'border-success border-2' : ''}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">Regular Method</CardTitle>
                    {result.recommendedMethod === 'regular' && (
                      <span className="text-xs bg-success/15 text-success px-2 py-0.5 rounded-full">
                        Recommended
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-primary">
                    ${result.totalAnnualDeduction.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">per year</p>
                  <div className="mt-3 pt-3 border-t space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Rent/Mortgage:</span>
                      <span>${result.annualRentDeduction.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Utilities:</span>
                      <span>${result.annualUtilitiesDeduction.toLocaleString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={`${result.recommendedMethod === 'simplified' ? 'border-success border-2' : ''}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">Simplified Method</CardTitle>
                    {result.recommendedMethod === 'simplified' && (
                      <span className="text-xs bg-success/15 text-success px-2 py-0.5 rounded-full">
                        Recommended
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-primary">
                    ${result.simplifiedDeduction.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">per year</p>
                  <div className="mt-3 pt-3 border-t text-sm">
                    <p className="text-muted-foreground">
                      $5 × {Math.min(parseFloat(businessSqFt), 300)} sq ft
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      (max 300 sq ft = $1,500)
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <Percent className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-lg font-bold">{result.businessPercentage}%</p>
                <p className="text-xs text-muted-foreground">Business Use</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <Calculator className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-lg font-bold">${result.monthlyDeduction.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">Monthly Savings</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <Home className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-lg font-bold">{businessSqFt}</p>
                <p className="text-xs text-muted-foreground">Business Sq Ft</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <DollarSign className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-lg font-bold">
                  ${Math.max(result.totalAnnualDeduction, result.simplifiedDeduction).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Best Deduction</p>
              </div>
            </div>

            {/* IRS Notice */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>IRS Form 8829</AlertTitle>
              <AlertDescription>
                Use IRS Form 8829 to claim home office deductions. The regular method requires tracking actual expenses, 
                while the simplified method just needs square footage. Consult a tax professional for personalized advice.
              </AlertDescription>
            </Alert>

            <Button onClick={resetCalculator} variant="outline" className="w-full">
              <Calculator className="h-4 w-4 mr-2" />
              Calculate Another Space
            </Button>
          </div>
        )}

        {/* Navigation Buttons */}
        {step <= totalSteps && (
          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setStep(step - 1)}
              disabled={step === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            
            {step < totalSteps ? (
              <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}>
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={calculateDeduction} disabled={!canProceed()}>
                <Calculator className="h-4 w-4 mr-2" />
                Calculate Deduction
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
