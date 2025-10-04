import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ThemeSwitcher } from '@/components/ui/theme-switcher';

export default function Home() {
  return (
    <div className="p-10 space-y-6">
      <h2>Button</h2>
      <Button>Button</Button>

      <h2>Slider</h2>
      <Slider
        defaultValue={ [50] }
        max={ 100 }
        step={ 1 }
        className='w-[300px]'
      />

      <h2>Switch</h2>
      <div className='flex flex-row space-x-2 items-center'>
        <Switch />
        <Label>This is a switch.</Label>
      </div>

      <h2>Theme Switcher</h2>
      <div className='flex flex-row space-x-2 items-center'>
        <ThemeSwitcher />
        <Label>This is a theme switcher.</Label>
      </div>

      <h2>Tabs</h2>
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1" >Tab 1</TabsTrigger>
          <TabsTrigger value="tab2" >Tab 2</TabsTrigger>
        </TabsList>
      </Tabs>

      <h2>Checkbox</h2>
      <div className="flex flex-row space-x-2 items-center">
        <Checkbox
          value="c1"
          defaultChecked
        />
        <Label htmlFor="c1">This is a checkbox.</Label>
      </div>

      <h2>Text Selection</h2>
      <p>
        Try selecting this text to see how it looks with the current theme.
      </p>
    </div>
  );
}
