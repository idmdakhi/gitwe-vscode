import { Express, Request, Response } from "express";
import { GitweClient } from "../gitwe/client";
import { DomainError } from "gitwe-ts";

export function setupRoutes(app: Express, client: GitweClient) {
  // ---- وضعیت کلی ----
  app.get("/api/status", async (req: Request, res: Response) => {
    try {
      const root = (req.query.root as string) || "main";
      const report = await client.getStatus(root);
      res.json({ success: true, data: report });
    } catch (error) {
      handleError(res, error);
    }
  });

  // ---- لیست شاخه‌ها ----
  app.get("/api/branches", async (req: Request, res: Response) => {
    try {
      const branches = await client.listBranches();
      const current = await client.getCurrentBranch();
      res.json({ success: true, data: { branches, current } });
    } catch (error) {
      handleError(res, error);
    }
  });

  // ---- اطلاعات یک شاخه (با commit‌ها) ----
  app.get("/api/branches/:name", async (req: Request, res: Response) => {
    try {
      const branchName = req.params.name;
      // استفاده از GitRepository برای دریافت commit‌ها
      const git = client.git;
      // دریافت آخرین commit (برای سادگی)
      const commit = await git.getCommitInfo(branchName);
      res.json({
        success: true,
        data: { branch: branchName, latestCommit: commit },
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  // ---- شروع شاخه ----
  app.post("/api/start", async (req: Request, res: Response) => {
    try {
      const { type, shortName } = req.body;
      if (!type || !shortName) {
        return res
          .status(400)
          .json({ success: false, error: "Missing type or shortName" });
      }
      const result = await client.startBranch(type, shortName);
      res.json({ success: true, data: result });
    } catch (error) {
      handleError(res, error);
    }
  });

  // ---- پایان شاخه ----
  app.post("/api/finish", async (req: Request, res: Response) => {
    try {
      const {
        branchName,
        deleteAfterMerge = true,
        pushAfterFinish = false,
      } = req.body;
      if (!branchName) {
        return res
          .status(400)
          .json({ success: false, error: "Missing branchName" });
      }
      const result = await client.finishBranch(
        branchName,
        deleteAfterMerge,
        pushAfterFinish,
      );
      res.json({ success: true, data: result });
    } catch (error) {
      handleError(res, error);
    }
  });

  // ---- Doctor ----
  app.get("/api/doctor", async (req: Request, res: Response) => {
    try {
      const report = await client.doctor();
      res.json({ success: true, data: report });
    } catch (error) {
      handleError(res, error);
    }
  });

  // ---- Config ----
  app.get("/api/config", (req: Request, res: Response) => {
    try {
      const config = client.getWorkflowConfig();
      res.json({ success: true, data: config });
    } catch (error) {
      handleError(res, error);
    }
  });

  // ---- اعتبارسنجی config (ارسال مسیر) ----
  app.post("/api/validate", async (req: Request, res: Response) => {
    try {
      const { configPath } = req.body;
      if (!configPath) {
        return res
          .status(400)
          .json({ success: false, error: "Missing configPath" });
      }
      const result = client.validateConfig(configPath);
      res.json({ success: true, data: result });
    } catch (error) {
      handleError(res, error);
    }
  });

  // ---- checkout ----
  app.post("/api/checkout", async (req: Request, res: Response) => {
    try {
      const { branchName } = req.body;
      if (!branchName) {
        return res
          .status(400)
          .json({ success: false, error: "Missing branchName" });
      }
      await client.checkout(branchName);
      res.json({ success: true, data: { branch: branchName } });
    } catch (error) {
      handleError(res, error);
    }
  });

  // ---- دریافت commit log یک شاخه ----
  app.get("/api/commits/:branch", async (req: Request, res: Response) => {
    try {
      const branch = req.params.branch;
      const git = client.git;
      // اجرای دستور git log با فرمت JSON
      const output = await git.runRaw([
        "log",
        "--pretty=format:%H|%an|%ae|%aI|%s",
        "-n",
        "20",
        branch,
      ]);
      const lines = output.stdout.split("\n").filter(Boolean);
      const commits = lines.map((line) => {
        const [hash, author, email, date, message] = line.split("|");
        return { hash, author, email, date, message };
      });
      res.json({ success: true, data: commits });
    } catch (error) {
      handleError(res, error);
    }
  });

  // ---- Diff بین دو شاخه ----
  app.get("/api/diff", async (req: Request, res: Response) => {
    try {
      const { from, to } = req.query;
      if (!from || !to) {
        return res
          .status(400)
          .json({ success: false, error: "Missing from/to" });
      }
      const git = client.git;
      const output = await git.runRaw([
        "diff",
        "--stat",
        from as string,
        to as string,
      ]);
      res.json({ success: true, data: { diff: output.stdout } });
    } catch (error) {
      handleError(res, error);
    }
  });

  // ---- مدیریت remoteها ----
  app.get("/api/remotes", async (req: Request, res: Response) => {
    try {
      const git = client.git;
      const output = await git.runRaw(["remote", "-v"]);
      res.json({ success: true, data: { remotes: output.stdout } });
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/api/push", async (req: Request, res: Response) => {
    try {
      const { remote = "origin", branch } = req.body;
      const git = client.git;
      await git.push(remote, branch);
      res.json({ success: true, data: { remote, branch } });
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/api/pull", async (req: Request, res: Response) => {
    try {
      const { remote = "origin", branch } = req.body;
      const git = client.git;
      await git.pull(remote, branch);
      res.json({ success: true, data: { remote, branch } });
    } catch (error) {
      handleError(res, error);
    }
  });
}

function handleError(res: Response, error: unknown) {
  if (error instanceof DomainError) {
    res
      .status(400)
      .json({ success: false, code: error.code, message: error.message });
  } else {
    res.status(500).json({
      success: false,
      code: "INTERNAL_ERROR",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
