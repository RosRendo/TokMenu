import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/Blocks";
import { useI18n } from "@/lib/i18n";
import { OrderBoard } from "./OrderBoard";
import { OrderHistory } from "./OrderHistory";

export default function Orders() {
  const { tr } = useI18n();
  return (
    <div>
      <PageHeader title={tr("Orders", "ការកុម្ម៉ង់")} description={tr("Accept new orders, move them through the kitchen, and record payments taken at the counter.", "ទទួលការកុម្ម៉ង់ថ្មី តាមដានក្នុងផ្ទះបាយ និងកត់ត្រាការបង់ប្រាក់នៅបញ្ជរ។")} />
      <Tabs defaultValue="board">
        <TabsList className="mb-4">
          <TabsTrigger value="board" data-testid="orders-tab-board">{tr("Live board", "ផ្ទាំងផ្ទាល់")}</TabsTrigger>
          <TabsTrigger value="history" data-testid="orders-tab-history">{tr("History", "ប្រវត្តិ")}</TabsTrigger>
        </TabsList>
        <TabsContent value="board"><OrderBoard /></TabsContent>
        <TabsContent value="history"><OrderHistory /></TabsContent>
      </Tabs>
    </div>
  );
}
