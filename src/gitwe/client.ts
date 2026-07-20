import * as vscode from "vscode";
import {
  Container,
  Workflow,
  ShellGitRepository,
  StartBranchHandler,
  FinishBranchHandler,
  GetStatusHandler,
  ListBranchesHandler,
  DoctorHandler,
  ValidateWorkflowHandler,
  type StartBranchCommand,
  type FinishBranchCommand,
  type StatusReport,
  type StartBranchResult,
  type FinishBranchResult,
  type DoctorReport,
  type ValidateWorkflowResult,
} from "gitwe";
import { getConfig } from "../config/settings";

export class GitweClient {
  private container: Container | undefined;
  private logger: vscode.OutputChannel;

  constructor(private context: vscode.ExtensionContext) {
    this.logger = vscode.window.createOutputChannel("Gitwe");
    this.context.subscriptions.push(this.logger);
  }

  async initialize() {
    const config = getConfig();
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const cwd = workspaceFolders?.[0]?.uri.fsPath || process.cwd();

    try {
      this.container = new Container({
        builtIn: config.workflow,
        configPath: config.configPath || undefined,
        quiet: true,
        cwd,
      });
      this.logger.appendLine("✅ Gitwe client initialized");
    } catch (error) {
      this.logger.appendLine(`❌ Failed to initialize Gitwe: ${error}`);
      throw error;
    }
  }

  private ensureContainer(): Container {
    if (!this.container) {
      throw new Error("Gitwe client not initialized");
    }
    return this.container;
  }

  get workflow(): Workflow {
    return this.ensureContainer().workflow;
  }

  get git(): ShellGitRepository {
    return this.ensureContainer().git as ShellGitRepository;
  }

  async startBranch(
    type: string,
    shortName: string,
  ): Promise<StartBranchResult> {
    const handler = this.ensureContainer().startBranchHandler;
    const command: StartBranchCommand = { branchType: type, shortName };
    const result = await handler.handle(command);
    this.logger.appendLine(
      `✅ Started branch: ${result.branchName} from ${result.baseBranch}`,
    );
    return result;
  }

  async finishBranch(
    branchName: string,
    deleteAfterMerge: boolean = true,
    pushAfterFinish: boolean = false,
  ): Promise<FinishBranchResult> {
    const handler = this.ensureContainer().finishBranchHandler;
    const command: FinishBranchCommand = {
      branchName,
      deleteAfterMerge,
      pushAfterFinish,
    };
    const result = await handler.handle(command);
    this.logger.appendLine(`✅ Finished branch: ${branchName}`);
    return result;
  }

  async getStatus(rootBranch: string = "main"): Promise<StatusReport> {
    const handler = this.ensureContainer().getStatusHandler;
    return handler.handle({ rootBranch });
  }

  async listBranches() {
    const handler = this.ensureContainer().listBranchesHandler;
    return handler.handle();
  }

  async getCurrentBranch(): Promise<string> {
    return this.ensureContainer().git.getCurrentBranch();
  }

  async doctor(): Promise<DoctorReport> {
    const handler = this.ensureContainer().doctorHandler;
    return handler.handle();
  }

  async validateConfig(configPath: string): Promise<ValidateWorkflowResult> {
    const handler = this.ensureContainer().validateWorkflowHandler;
    return handler.handle(configPath);
  }

  async checkout(branchName: string): Promise<void> {
    await this.ensureContainer().git.checkout(branchName);
    this.logger.appendLine(`✅ Checked out: ${branchName}`);
  }

  async getWorkflowConfig() {
    const w = this.ensureContainer().workflow;
    return {
      name: w.name,
      remote: {
        remote: w.remote.remote,
        autoPush: w.remote.autoPush,
        autoPull: w.remote.autoPull,
      },
      branchTypes: w.branchTypes.map((rule) => ({
        name: rule.name,
        prefix: rule.prefix,
        baseBranch: rule.baseBranch,
        mergeTargets: rule.mergeTargets,
        deleteOnFinish: rule.deleteOnFinish,
      })),
    };
  }

  getOutputChannel(): vscode.OutputChannel {
    return this.logger;
  }

  async rebase(branch: string, onto: string): Promise<void> {
    const git = this.ensureContainer().git;
    await git.runRaw(["rebase", onto, branch]);
  }

  async cherryPick(commitHash: string): Promise<void> {
    const git = this.ensureContainer().git;
    await git.runRaw(["cherry-pick", commitHash]);
  }

  async stashPush(message?: string): Promise<void> {
    const git = this.ensureContainer().git;
    const args = ["stash", "push"];
    if (message) args.push("-m", message);
    await git.runRaw(args);
  }

  async stashPop(): Promise<void> {
    const git = this.ensureContainer().git;
    await git.runRaw(["stash", "pop"]);
  }

  async getStashList(): Promise<string[]> {
    const git = this.ensureContainer().git;
    const result = await git.runRaw(["stash", "list"]);
    return result.stdout.split("\n").filter(Boolean);
  }
}
