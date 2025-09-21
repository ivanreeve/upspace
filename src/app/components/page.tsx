import { Checkbox } from '@radix-ui/react-checkbox';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Home() {
  return (
    <>
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
      <Switch />

      <h2>Tabs</h2>
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1" >Tab 1</TabsTrigger>
          <TabsTrigger value="tab2" >Tab 2</TabsTrigger>
        </TabsList>
      </Tabs>

      <h2>Checkbox</h2>
      <Checkbox
        defaultChecked
      />
    </>
  );
}
