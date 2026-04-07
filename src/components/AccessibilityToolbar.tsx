import { useAccessibility } from "@/contexts/AccessibilityContext";
import { Eye, Type, Zap, Layout, Moon, Sun, Contrast } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function AccessibilityToolbar() {
  const {
    highContrast,
    largeText,
    reducedMotion,
    simplified,
    darkMode,
    toggleHighContrast,
    toggleLargeText,
    toggleReducedMotion,
    toggleSimplified,
    toggleDarkMode,
  } = useAccessibility();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="touch-target"
          aria-label="Accessibility settings"
        >
          <Eye className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-4" role="group" aria-label="Accessibility options">
          <h3 className="font-semibold text-sm">Accessibility Settings</h3>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="dark-mode" className="flex items-center gap-2 cursor-pointer">
              {darkMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              Dark Mode
            </Label>
            <Switch id="dark-mode" checked={darkMode} onCheckedChange={toggleDarkMode} />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="high-contrast" className="flex items-center gap-2 cursor-pointer">
              <Contrast className="h-4 w-4" />
              High Contrast
            </Label>
            <Switch id="high-contrast" checked={highContrast} onCheckedChange={toggleHighContrast} />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="large-text" className="flex items-center gap-2 cursor-pointer">
              <Type className="h-4 w-4" />
              Large Text (150%)
            </Label>
            <Switch id="large-text" checked={largeText} onCheckedChange={toggleLargeText} />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="reduced-motion" className="flex items-center gap-2 cursor-pointer">
              <Zap className="h-4 w-4" />
              Reduced Motion
            </Label>
            <Switch id="reduced-motion" checked={reducedMotion} onCheckedChange={toggleReducedMotion} />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="simplified" className="flex items-center gap-2 cursor-pointer">
              <Layout className="h-4 w-4" />
              Simplified View
            </Label>
            <Switch id="simplified" checked={simplified} onCheckedChange={toggleSimplified} />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
