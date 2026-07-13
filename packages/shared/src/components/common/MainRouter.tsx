import React from "react";
import { AppView, UserSummary, WorkspaceSummary, ProjectSummary, CustomerSummary, BrandKitSummary, AssetSummary, ProjectCanvasDocument, CreditTransactionSummary, GenerationTaskSummary, PlanSummary, RechargeRecordSummary, OrderSummary, ModelSummary, GenerationTaskDetail } from "../../types";
import type { RetouchSettings } from "../asset/AssetEditorWorkbench";

// Subview components
import { ModelSquare } from "../square/ModelSquare";
import { DashboardView } from "../dashboard/DashboardView";
import { ProjectsView } from "../project/ProjectsView";
import { CustomersView } from "../customer/CustomersView";
import { AssetsView } from "../asset/AssetsView";
import { HistoryView } from "../history/HistoryView";
import { CreditsView } from "../credits/CreditsView";
import { AdminConsole } from "../admin/AdminConsole";

interface MainRouterProps {
  activeView: AppView;
  currentUser: UserSummary | null;
  setCurrentUser: (user: UserSummary | null) => void;
  triggerLogin: (callback?: () => void) => void;
  setIsNewProjectModalOpen: (open: boolean) => void;
  setActiveView: (view: AppView) => void;
  setSelectedProjectId: (id: string) => void;
  loadProjectAssets: (projectId: string) => Promise<void>;
  loadProjectCanvas: (projectId: string) => Promise<void>;
  setProjectsViewMode: (mode: "list" | "detail") => void;
  handleViewChange: (view: AppView) => void;
  exportCurrentProject: (format: "json" | "markdown") => void;
  handleSaveRetouchSettings: (assetId: string, settings: RetouchSettings) => Promise<any>;
  handleExportRetouchImage: (assetId: string, settings: RetouchSettings) => Promise<any>;
  handleSaveCustomer: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  deleteAsset: (assetId: string) => Promise<void>;
  handleMockPay: () => Promise<void>;
  handleCreateOrder: (planId: string) => Promise<void>;
  loadActiveModels: () => Promise<void>;

  activeWorkspace?: WorkspaceSummary;
  isApiOnline: boolean;
  formattedCredits: string;
  projects: ProjectSummary[];
  setProjects: any;
  selectedProject: ProjectSummary | null;
  projectsViewMode: "list" | "detail";
  assets: AssetSummary[];
  setAssets: any;
  projectCanvas: any;
  setProjectCanvas: any;
  customers: CustomerSummary[];
  setCustomers: any;
  brandKits: BrandKitSummary[];
  setBrandKits: any;
  currentRole: string | null;
  transactions: CreditTransactionSummary[];
  setTransactions: any;
  setTasks: any;
  setSelectedTaskId: any;
  setTaskDetail: any;
  deletingAssetId: string;
  models: ModelSummary[];
  setPreviewAsset: any;
  setRetouchInitialSettings: any;
  setEditingAsset: any;
  
  selectedCustomer: CustomerSummary | null;
  setSelectedCustomerId: (id: string) => void;
  customerEditForm: { name: string; industry: string; notes: string };
  setCustomerEditForm: (form: { name: string; industry: string; notes: string }) => void;
  isSavingCustomer: boolean;

  plans: PlanSummary[];
  rechargeRecords: RechargeRecordSummary[];
  pendingOrder: OrderSummary | null;
  isPayingOrder: boolean;
  isCreatingOrder: boolean;
  creditsTab: "transactions" | "recharges";
  setCreditsTab: (tab: "transactions" | "recharges") => void;
  formattedRecharge: string;
  formattedGift: string;
  formattedRefund: string;

  searchQuery: string;
  setSearchQuery: (q: string) => void;
  categories: any[];
  setCategories: (cats: any[]) => void;
  selectedWorkflowType: string;
  setSelectedWorkflowType: (type: string) => void;
  selectedCategoryId: string;
  setSelectedCategoryId: (id: string) => void;
  selectedSubCategoryId: string;
  setSelectedSubCategoryId: (id: string) => void;
  tasks: GenerationTaskSummary[];
}

export function MainRouter({
  activeView,
  currentUser,
  setCurrentUser,
  triggerLogin,
  setIsNewProjectModalOpen,
  setActiveView,
  setSelectedProjectId,
  loadProjectAssets,
  loadProjectCanvas,
  setProjectsViewMode,
  handleViewChange,
  exportCurrentProject,
  handleSaveRetouchSettings,
  handleExportRetouchImage,
  handleSaveCustomer,
  deleteAsset,
  handleMockPay,
  handleCreateOrder,
  loadActiveModels,

  activeWorkspace,
  isApiOnline,
  formattedCredits,
  projects,
  setProjects,
  selectedProject,
  projectsViewMode,
  assets,
  setAssets,
  projectCanvas,
  setProjectCanvas,
  customers,
  setCustomers,
  brandKits,
  setBrandKits,
  currentRole,
  transactions,
  setTransactions,
  setTasks,
  setSelectedTaskId,
  setTaskDetail,
  deletingAssetId,
  models,
  setPreviewAsset,
  setRetouchInitialSettings,
  setEditingAsset,

  selectedCustomer,
  setSelectedCustomerId,
  customerEditForm,
  setCustomerEditForm,
  isSavingCustomer,

  plans,
  rechargeRecords,
  pendingOrder,
  isPayingOrder,
  isCreatingOrder,
  creditsTab,
  setCreditsTab,
  formattedRecharge,
  formattedGift,
  formattedRefund,

  searchQuery,
  setSearchQuery,
  categories,
  setCategories,
  selectedWorkflowType,
  setSelectedWorkflowType,
  selectedCategoryId,
  setSelectedCategoryId,
  selectedSubCategoryId,
  setSelectedSubCategoryId,
  tasks,
}: MainRouterProps) {
  switch (activeView) {
    case "square":
      return (
        <ModelSquare
          currentUser={currentUser}
          triggerLogin={triggerLogin}
          onUseTemplate={(template) => {
            setIsNewProjectModalOpen(true);
            setActiveView("workbench");
          }}
          onUseTemplateWithProject={(template, projectId) => {
            setSelectedProjectId(projectId);
            setActiveView("projects");
            setProjectsViewMode("detail");
            void loadProjectAssets(projectId);
            void loadProjectCanvas(projectId);
          }}
          projects={projects}
          onNavigateToView={handleViewChange}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          categories={categories}
          setCategories={setCategories}
          selectedWorkflowType={selectedWorkflowType}
          setSelectedWorkflowType={setSelectedWorkflowType}
          selectedCategoryId={selectedCategoryId}
          setSelectedCategoryId={setSelectedCategoryId}
          selectedSubCategoryId={selectedSubCategoryId}
          setSelectedSubCategoryId={setSelectedSubCategoryId}
        />
      );
    case "workbench":
      return (
        <DashboardView
          activeWorkspace={activeWorkspace}
          isApiOnline={isApiOnline}
          formattedCredits={formattedCredits}
          projects={projects}
          tasks={tasks}
          transactions={transactions}
          setIsNewProjectModalOpen={setIsNewProjectModalOpen}
          setActiveView={setActiveView}
          setSelectedProjectId={setSelectedProjectId}
          loadProjectAssets={loadProjectAssets}
          loadProjectCanvas={loadProjectCanvas}
          setProjectsViewMode={setProjectsViewMode}
          customers={customers}
          brandKits={brandKits}
        />
      );
    case "projects":
      return (
        <ProjectsView
          activeWorkspace={activeWorkspace}
          projects={projects}
          setProjects={setProjects}
          setSelectedProjectId={setSelectedProjectId}
          selectedProject={selectedProject}
          projectsViewMode={projectsViewMode}
          setProjectsViewMode={setProjectsViewMode}
          assets={assets}
          setAssets={setAssets}
          projectCanvas={projectCanvas}
          setProjectCanvas={setProjectCanvas}
          loadProjectAssets={loadProjectAssets}
          loadProjectCanvas={loadProjectCanvas}
          customers={customers}
          brandKits={brandKits}
          currentRole={currentRole ?? "工作区成员"}
          currentUser={currentUser}
          transactions={transactions}
          setTransactions={setTransactions as any}
          setTasks={setTasks}
          setSelectedTaskId={setSelectedTaskId}
          setTaskDetail={setTaskDetail}
          deletingAssetId={deletingAssetId}
          deleteAsset={deleteAsset}
          setIsNewProjectModalOpen={setIsNewProjectModalOpen}
          models={models}
          onEnterEditor={(asset, settings) => {
            setRetouchInitialSettings(settings || null);
            setEditingAsset(asset);
          }}
          setPreviewAsset={setPreviewAsset}
          onSaveSettings={handleSaveRetouchSettings}
          onExportImage={handleExportRetouchImage}
        />
      );
    case "customers":
      return (
        <CustomersView
          activeWorkspace={activeWorkspace}
          customers={customers}
          setCustomers={setCustomers}
          selectedCustomer={selectedCustomer || undefined}
          setSelectedCustomerId={setSelectedCustomerId}
          projects={projects}
          brandKits={brandKits}
          setBrandKits={setBrandKits}
          customerEditForm={customerEditForm}
          setCustomerEditForm={setCustomerEditForm}
          handleSaveCustomer={handleSaveCustomer}
          isSavingCustomer={isSavingCustomer}
          setActiveView={setActiveView}
          setSelectedProjectId={setSelectedProjectId}
        />
      );
    case "assets":
      return (
        <AssetsView
          assets={assets}
          setAssets={setAssets}
          selectedProject={selectedProject || undefined}
          activeWorkspace={activeWorkspace}
          currentUser={currentUser!}
          setPreviewAsset={setPreviewAsset}
          deleteAsset={deleteAsset}
          deletingAssetId={deletingAssetId}
        />
      );
    case "history":
      return (
        <HistoryView
          assets={assets}
          selectedProject={selectedProject || undefined}
          exportCurrentProject={exportCurrentProject}
        />
      );
    case "credits":
      return (
        <CreditsView
          activeWorkspace={activeWorkspace}
          plans={plans}
          transactions={transactions}
          rechargeRecords={rechargeRecords}
          pendingOrder={pendingOrder}
          isPayingOrder={isPayingOrder}
          isCreatingOrder={isCreatingOrder}
          creditsTab={creditsTab}
          setCreditsTab={setCreditsTab}
          handleMockPay={handleMockPay}
          handleCreateOrder={handleCreateOrder}
          formattedCredits={formattedCredits}
          formattedRecharge={formattedRecharge}
          formattedGift={formattedGift}
          formattedRefund={formattedRefund}
        />
      );
    case "admin":
      return (
        <AdminConsole
          activeWorkspace={activeWorkspace}
          isApiOnline={isApiOnline}
          formattedCredits={formattedCredits}
          currentUser={currentUser}
          setCurrentUser={setCurrentUser}
          onBack={() => {
            setActiveView("workbench");
            void loadActiveModels();
          }}
        />
      );
    default:
      return null;
  }
}
