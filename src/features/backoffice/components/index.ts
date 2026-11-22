// Barrel export untuk seluruh komponen backoffice terkelompok per domain (Clean Architecture)

// 1. Finance Domain
export { FinancePageView } from './finance/finance-page'
export { FinancialOverview } from './finance/financial-overview'
export { WithdrawalDrawer } from './finance/withdrawal-drawer'
export { ProfitTab } from './finance/profit-tab'

// 2. Settings Domain
export { StoreTab } from './settings/store-tab'
export { SetupChecklist } from './settings/setup-checklist'
export { LanguageTab } from './settings/language-tab'
export { MidtransSettings } from './settings/midtrans-settings'
export { PrinterCalibration } from './settings/printer-calibration'
export { CashFloatSettings } from './settings/cash-float-settings'
export { KitchenSettings } from './settings/kitchen-settings'
export { PermissionSettings, ShiftNamesSettings } from './settings/access-settings'

// 3. Menu Catalog & Master Data Domain
export { MenuTab } from './menu/menu-tab'
export { CategoriesTab } from './menu/categories-tab'
export { CategoriesDialog } from './menu/categories-dialog'
export { ProductForm } from './menu/product-form'
export { ModifierEditor } from './menu/modifier-editor'
export { StarterMenuPicker } from './menu/starter-menu-picker'

// 4. Operations & Shift Management Domain
export { OpsTab } from './operations/ops-tab'
export { ShiftDetailDrawer } from './operations/shift-detail'
export { StaffList } from './operations/staff-list'
export { TablesTab } from './operations/tables-tab'

// 5. CRM, Loyalty & Promotion Domain
export { MembersTab } from './crm/members-tab'
export { PromoTab } from './crm/promo-tab'

// 6. Dashboard & Analytics Domain
export { Dashboard } from './dashboard/dashboard'
export { ReportPageView, fetchReport, type Report } from './dashboard/report-page'
export { MorePageView } from './dashboard/more-page'

// 7. Inventory & Supply Chain Domain
export { InventoryPage } from './inventory/inventory-page'
export { PurchasingPage } from './purchasing/purchasing-page'
