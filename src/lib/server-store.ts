import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import {
  DEFAULT_QUOTE_COPY,
  MINT_BUNDLES,
  QUIZ_QUESTIONS,
  SOCIAL_TASKS,
  TOKENS_PER_MINT,
  type MintBundleId,
  type QuizChoice,
  type SocialTaskId,
} from "@/lib/content";
import {
  EMPTY_ADDRESS_STATE,
  EMPTY_GLOBAL_LEDGER,
  calculateRemainingQuota,
  canVerifyTask,
  evaluateQuiz,
  type AddressQuestState,
  type BlessingResult,
  type GlobalMintLedger,
} from "@/lib/mint";
import { scoreBlessingMessage } from "@/lib/scoring";
import { sqliteDatabasePath } from "@/lib/runtime-config";

type AddressRow = {
  address: string;
  quoteDraft: string;
  quizPassed: number;
  blessingText: string;
  blessingScore: number | null;
  blessingPassed: number | null;
  blessingReason: string | null;
  blessingCheckedAt: number | null;
  mintedUsed: number;
};

type SocialRow = {
  taskId: SocialTaskId;
  launchedAt: number | null;
  verified: number;
};

type QuizRow = {
  questionId: number;
  choice: QuizChoice | null;
};

type MintRecordResult = {
  bundleId: MintBundleId;
  quotaCost: number;
  state: AddressQuestState;
  globalLedger: GlobalMintLedger;
};

type MintConfirmationResult = MintRecordResult & {
  alreadyRecorded: boolean;
};

export type TokenDistributionStatus =
  | "pending"
  | "submitting"
  | "submitted"
  | "confirmed"
  | "failed"
  | "simulated";

type TokenDistributionRow = {
  sourceId: string;
  address: string;
  bundleId: MintBundleId;
  units: number;
  amountWei: string;
  status: TokenDistributionStatus;
  txHash: `0x${string}` | null;
  providerReference: string | null;
  distributorWalletAddress: `0x${string}` | null;
  errorMessage: string | null;
  createdAt: number;
  updatedAt: number;
};

export type TokenDistributionSnapshot = {
  purchasedUnits: number;
  deliveredUnits: number;
  pendingUnits: number;
  failedUnits: number;
  cumulativeAmount: string;
  deliveredAmount: string;
  pendingAmount: string;
  latestStatus: TokenDistributionStatus | "idle";
  latestTxHash: `0x${string}` | null;
  latestError: string | null;
  distributorWalletAddress: `0x${string}` | null;
};

const TOKEN_DECIMALS = BigInt(10) ** BigInt(18);
const TOKENS_PER_MINT_WEI = BigInt(TOKENS_PER_MINT) * TOKEN_DECIMALS;

declare global {
  var __miniAsteroidDb: Database.Database | undefined;
}

function now() {
  return Date.now();
}

function getDb() {
  if (globalThis.__miniAsteroidDb) {
    return globalThis.__miniAsteroidDb;
  }

  const dbPath = path.isAbsolute(sqliteDatabasePath)
    ? sqliteDatabasePath
    : path.join(/* turbopackIgnore: true */ process.cwd(), sqliteDatabasePath);

  mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS address_states (
      address TEXT PRIMARY KEY,
      quoteDraft TEXT NOT NULL,
      quizPassed INTEGER NOT NULL DEFAULT 0,
      blessingText TEXT NOT NULL DEFAULT '',
      blessingScore INTEGER,
      blessingPassed INTEGER,
      blessingReason TEXT,
      blessingCheckedAt INTEGER,
      mintedUsed INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS social_tasks (
      address TEXT NOT NULL,
      taskId TEXT NOT NULL,
      launchedAt INTEGER,
      verified INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (address, taskId)
    );

    CREATE TABLE IF NOT EXISTS quiz_answers (
      address TEXT NOT NULL,
      questionId INTEGER NOT NULL,
      choice TEXT,
      PRIMARY KEY (address, questionId)
    );

    CREATE TABLE IF NOT EXISTS global_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      minted INTEGER NOT NULL DEFAULT 0,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mint_payments (
      txHash TEXT PRIMARY KEY,
      address TEXT NOT NULL,
      bundleId TEXT NOT NULL,
      quotaCost INTEGER NOT NULL,
      amountWei TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS token_distributions (
      sourceId TEXT PRIMARY KEY,
      address TEXT NOT NULL,
      bundleId TEXT NOT NULL,
      units INTEGER NOT NULL,
      amountWei TEXT NOT NULL,
      status TEXT NOT NULL,
      txHash TEXT,
      providerReference TEXT,
      distributorWalletAddress TEXT,
      errorMessage TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS token_distributions_address_idx
      ON token_distributions (address, createdAt DESC);
  `);

  db.prepare(
    "INSERT INTO global_state (id, minted, updatedAt) VALUES (1, 0, ?) ON CONFLICT(id) DO NOTHING"
  ).run(now());

  globalThis.__miniAsteroidDb = db;
  return db;
}

function normalizeAddress(address: string) {
  return address.trim().toLowerCase();
}

function ensureAddress(addressInput: string) {
  const address = normalizeAddress(addressInput);
  const db = getDb();
  const timestamp = now();

  const tx = db.transaction(() => {
    db.prepare(
      `
        INSERT INTO address_states (
          address,
          quoteDraft,
          quizPassed,
          blessingText,
          mintedUsed,
          createdAt,
          updatedAt
        ) VALUES (?, ?, 0, '', 0, ?, ?)
        ON CONFLICT(address) DO NOTHING
      `
    ).run(address, DEFAULT_QUOTE_COPY, timestamp, timestamp);

    const socialStmt = db.prepare(
      `
        INSERT INTO social_tasks (address, taskId, launchedAt, verified)
        VALUES (?, ?, NULL, 0)
        ON CONFLICT(address, taskId) DO NOTHING
      `
    );

    for (const task of SOCIAL_TASKS) {
      socialStmt.run(address, task.id);
    }

    const quizStmt = db.prepare(
      `
        INSERT INTO quiz_answers (address, questionId, choice)
        VALUES (?, ?, NULL)
        ON CONFLICT(address, questionId) DO NOTHING
      `
    );

    for (const question of QUIZ_QUESTIONS) {
      quizStmt.run(address, question.id);
    }
  });

  tx();

  return address;
}

function getDistributionAmountWei(units: number) {
  return (BigInt(units) * TOKENS_PER_MINT_WEI).toString();
}

function ensureTokenDistribution(
  db: Database.Database,
  address: string,
  bundleId: MintBundleId,
  units: number,
  sourceId: string,
  status: TokenDistributionStatus = "pending"
) {
  const timestamp = now();

  db.prepare(
    `
      INSERT INTO token_distributions (
        sourceId,
        address,
        bundleId,
        units,
        amountWei,
        status,
        createdAt,
        updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(sourceId) DO NOTHING
    `
  ).run(
    sourceId,
    address,
    bundleId,
    units,
    getDistributionAmountWei(units),
    status,
    timestamp,
    timestamp
  );
}

function mapAddressState(address: string): AddressQuestState {
  const db = getDb();
  ensureAddress(address);

  const row = db
    .prepare(
      `
        SELECT
          address,
          quoteDraft,
          quizPassed,
          blessingText,
          blessingScore,
          blessingPassed,
          blessingReason,
          blessingCheckedAt,
          mintedUsed
        FROM address_states
        WHERE address = ?
      `
    )
    .get(address) as AddressRow | undefined;

  const socialRows = db
    .prepare(
      "SELECT taskId, launchedAt, verified FROM social_tasks WHERE address = ? ORDER BY taskId ASC"
    )
    .all(address) as SocialRow[];

  const quizRows = db
    .prepare(
      "SELECT questionId, choice FROM quiz_answers WHERE address = ? ORDER BY questionId ASC"
    )
    .all(address) as QuizRow[];

  const initial = EMPTY_ADDRESS_STATE(DEFAULT_QUOTE_COPY);

  const social = { ...initial.social };
  for (const socialRow of socialRows) {
    social[socialRow.taskId] = {
      launchedAt: socialRow.launchedAt,
      verified: Boolean(socialRow.verified),
    };
  }

  const quizAnswers = { ...initial.quizAnswers };
  for (const quizRow of quizRows) {
    quizAnswers[quizRow.questionId] = quizRow.choice;
  }

  const blessingResult =
    row && row.blessingScore !== null && row.blessingPassed !== null && row.blessingReason
      ? {
          score: row.blessingScore,
          passed: Boolean(row.blessingPassed),
          reason: row.blessingReason,
          checkedAt: row.blessingCheckedAt ?? now(),
        }
      : null;

  return {
    social,
    quoteDraft: row?.quoteDraft || DEFAULT_QUOTE_COPY,
    quizAnswers,
    quizPassed: Boolean(row?.quizPassed),
    blessingText: row?.blessingText ?? "",
    blessingResult,
    mintedUsed: row?.mintedUsed ?? 0,
  };
}

export function getGlobalLedger(): GlobalMintLedger {
  const db = getDb();
  const row = db
    .prepare("SELECT minted FROM global_state WHERE id = 1")
    .get() as { minted: number } | undefined;

  return {
    ...EMPTY_GLOBAL_LEDGER,
    minted: row?.minted ?? 0,
  };
}

export function getSnapshot(address?: string | null) {
  return {
    state: address ? mapAddressState(normalizeAddress(address)) : EMPTY_ADDRESS_STATE(DEFAULT_QUOTE_COPY),
    globalLedger: getGlobalLedger(),
  };
}

export function getPurchasedMintUnits(addressInput: string) {
  const address = ensureAddress(addressInput);
  const state = mapAddressState(address);
  return state.mintedUsed;
}

export function getTokenDistributionSnapshot(addressInput: string): TokenDistributionSnapshot {
  const address = ensureAddress(addressInput);
  const db = getDb();
  const rows = db
    .prepare(
      `
        SELECT
          sourceId,
          address,
          bundleId,
          units,
          amountWei,
          status,
          txHash,
          providerReference,
          distributorWalletAddress,
          errorMessage,
          createdAt,
          updatedAt
        FROM token_distributions
        WHERE address = ?
        ORDER BY createdAt DESC
      `
    )
    .all(address) as TokenDistributionRow[];

  const purchasedUnits = getPurchasedMintUnits(address);
  const cumulativeAmount = (BigInt(purchasedUnits) * TOKENS_PER_MINT_WEI).toString();

  const deliveredRows = rows.filter(
    (row) => row.status === "confirmed" || row.status === "simulated"
  );
  const failedRows = rows.filter((row) => row.status === "failed");

  const deliveredUnits = deliveredRows.reduce((sum, row) => sum + row.units, 0);
  const failedUnits = failedRows.reduce((sum, row) => sum + row.units, 0);
  const deliveredAmount = deliveredRows
    .reduce((sum, row) => sum + BigInt(row.amountWei), BigInt(0))
    .toString();
  const pendingUnits = Math.max(0, purchasedUnits - deliveredUnits);
  const pendingAmountBigInt = BigInt(cumulativeAmount) - BigInt(deliveredAmount);
  const pendingAmount = (
    pendingAmountBigInt > BigInt(0) ? pendingAmountBigInt : BigInt(0)
  ).toString();

  return {
    purchasedUnits,
    deliveredUnits,
    pendingUnits,
    failedUnits,
    cumulativeAmount,
    deliveredAmount,
    pendingAmount,
    latestStatus: rows[0]?.status ?? "idle",
    latestTxHash: rows[0]?.txHash ?? null,
    latestError: rows[0]?.errorMessage ?? null,
    distributorWalletAddress: rows.find((row) => row.distributorWalletAddress)
      ?.distributorWalletAddress ?? null,
  };
}

export function getPendingTokenDistributions(addressInput: string) {
  const address = ensureAddress(addressInput);
  const db = getDb();

  return db
    .prepare(
      `
        SELECT
          sourceId,
          address,
          bundleId,
          units,
          amountWei,
          status,
          txHash,
          providerReference,
          distributorWalletAddress,
          errorMessage,
          createdAt,
          updatedAt
        FROM token_distributions
        WHERE address = ? AND status IN ('pending', 'failed')
        ORDER BY createdAt ASC
      `
    )
    .all(address) as TokenDistributionRow[];
}

export function getSubmittedTokenDistributions(addressInput: string) {
  const address = ensureAddress(addressInput);
  const db = getDb();

  return db
    .prepare(
      `
        SELECT
          sourceId,
          address,
          bundleId,
          units,
          amountWei,
          status,
          txHash,
          providerReference,
          distributorWalletAddress,
          errorMessage,
          createdAt,
          updatedAt
        FROM token_distributions
        WHERE address = ? AND status = 'submitted'
        ORDER BY createdAt ASC
      `
    )
    .all(address) as TokenDistributionRow[];
}

export function markTokenDistributionSubmitting(sourceId: string) {
  getDb()
    .prepare(
      `
        UPDATE token_distributions
        SET status = 'submitting', errorMessage = NULL, updatedAt = ?
        WHERE sourceId = ?
      `
    )
    .run(now(), sourceId);
}

export function markTokenDistributionSubmitted(
  sourceId: string,
  txHash: `0x${string}` | null,
  providerReference: string | null,
  distributorWalletAddress: `0x${string}` | null
) {
  getDb()
    .prepare(
      `
        UPDATE token_distributions
        SET
          status = 'submitted',
          txHash = COALESCE(?, txHash),
          providerReference = COALESCE(?, providerReference),
          distributorWalletAddress = COALESCE(?, distributorWalletAddress),
          errorMessage = NULL,
          updatedAt = ?
        WHERE sourceId = ?
      `
    )
    .run(txHash, providerReference, distributorWalletAddress, now(), sourceId);
}

export function markTokenDistributionConfirmed(
  sourceId: string,
  txHash?: `0x${string}` | null
) {
  getDb()
    .prepare(
      `
        UPDATE token_distributions
        SET
          status = 'confirmed',
          txHash = COALESCE(?, txHash),
          errorMessage = NULL,
          updatedAt = ?
        WHERE sourceId = ?
      `
    )
    .run(txHash ?? null, now(), sourceId);
}

export function markTokenDistributionFailed(
  sourceId: string,
  errorMessage: string,
  txHash?: `0x${string}` | null,
  providerReference?: string | null,
  distributorWalletAddress?: `0x${string}` | null
) {
  getDb()
    .prepare(
      `
        UPDATE token_distributions
        SET
          status = 'failed',
          txHash = COALESCE(?, txHash),
          providerReference = COALESCE(?, providerReference),
          distributorWalletAddress = COALESCE(?, distributorWalletAddress),
          errorMessage = ?,
          updatedAt = ?
        WHERE sourceId = ?
      `
    )
    .run(
      txHash ?? null,
      providerReference ?? null,
      distributorWalletAddress ?? null,
      errorMessage,
      now(),
      sourceId
    );
}

export function launchSocialTask(
  addressInput: string,
  taskId: SocialTaskId,
  quoteDraft?: string
) {
  const address = ensureAddress(addressInput);
  const db = getDb();
  const timestamp = now();

  db.transaction(() => {
    db.prepare(
      "UPDATE social_tasks SET launchedAt = ?, verified = verified WHERE address = ? AND taskId = ?"
    ).run(timestamp, address, taskId);

    if (typeof quoteDraft === "string" && taskId === "quote") {
      db.prepare(
        "UPDATE address_states SET quoteDraft = ?, updatedAt = ? WHERE address = ?"
      ).run(quoteDraft.trim() || DEFAULT_QUOTE_COPY, timestamp, address);
    } else {
      db.prepare("UPDATE address_states SET updatedAt = ? WHERE address = ?").run(
        timestamp,
        address
      );
    }
  })();

  return getSnapshot(address);
}

export function verifySocialTask(addressInput: string, taskId: SocialTaskId) {
  const address = ensureAddress(addressInput);
  const db = getDb();
  const row = db
    .prepare(
      "SELECT launchedAt, verified FROM social_tasks WHERE address = ? AND taskId = ?"
    )
    .get(address, taskId) as { launchedAt: number | null; verified: number } | undefined;

  if (!row) {
    throw new Error("Task progress was not found.");
  }

  if (row.verified) {
    return getSnapshot(address);
  }

  if (!canVerifyTask(row.launchedAt, now())) {
    throw new Error("Please wait a few seconds, then verify again.");
  }

  db.transaction(() => {
    db.prepare(
      "UPDATE social_tasks SET verified = 1 WHERE address = ? AND taskId = ?"
    ).run(address, taskId);
    db.prepare("UPDATE address_states SET updatedAt = ? WHERE address = ?").run(
      now(),
      address
    );
  })();

  return getSnapshot(address);
}

export function submitQuiz(
  addressInput: string,
  answers: Record<number, QuizChoice | null>
) {
  const address = ensureAddress(addressInput);
  const db = getDb();
  const result = evaluateQuiz(answers);
  const timestamp = now();

  db.transaction(() => {
    const upsert = db.prepare(
      `
        INSERT INTO quiz_answers (address, questionId, choice)
        VALUES (?, ?, ?)
        ON CONFLICT(address, questionId) DO UPDATE SET choice = excluded.choice
      `
    );

    for (const question of QUIZ_QUESTIONS) {
      upsert.run(address, question.id, answers[question.id] ?? null);
    }

    if (result.passed) {
      db.prepare(
        "UPDATE address_states SET quizPassed = 1, updatedAt = ? WHERE address = ?"
      ).run(timestamp, address);
    } else {
      db.prepare("UPDATE address_states SET updatedAt = ? WHERE address = ?").run(
        timestamp,
        address
      );
    }
  })();

  return {
    ...getSnapshot(address),
    result,
  };
}

export function reviewBlessing(addressInput: string, message: string) {
  const address = ensureAddress(addressInput);
  const db = getDb();
  const result = scoreBlessingMessage(message);
  const timestamp = now();

  db.prepare(
    `
      UPDATE address_states
      SET
        blessingText = ?,
        blessingScore = ?,
        blessingPassed = ?,
        blessingReason = ?,
        blessingCheckedAt = ?,
        updatedAt = ?
      WHERE address = ?
    `
  ).run(
    message.trim(),
    result.score,
    result.passed ? 1 : 0,
    result.reason,
    timestamp,
    timestamp,
    address
  );

  return {
    ...getSnapshot(address),
    blessing: {
      score: result.score,
      passed: result.passed,
      reason: result.reason,
      checkedAt: timestamp,
    } satisfies BlessingResult,
  };
}

export function recordMint(
  addressInput: string,
  bundleId: MintBundleId,
  sourceId = randomUUID(),
  distributionStatus: TokenDistributionStatus = "pending"
): MintRecordResult {
  const address = ensureAddress(addressInput);
  const bundle = MINT_BUNDLES.find((item) => item.id === bundleId);

  if (!bundle) {
    throw new Error("Mint bundle was not found.");
  }

  const db = getDb();
  const tx = db.transaction(() => {
    const state = mapAddressState(address);
    const globalLedger = getGlobalLedger();
    const remainingQuota = calculateRemainingQuota(state);

    if (remainingQuota < bundle.quotaCost) {
      throw new Error(
        `You need ${bundle.quotaCost} quota for this bundle. Finish more tasks or choose a smaller mint option.`
      );
    }

    if (globalLedger.minted + bundle.quotaCost > 4000) {
      throw new Error("The global mint cap is almost full, so this bundle is no longer available.");
    }

    db.prepare(
      "UPDATE address_states SET mintedUsed = mintedUsed + ?, updatedAt = ? WHERE address = ?"
    ).run(bundle.quotaCost, now(), address);

    db.prepare("UPDATE global_state SET minted = minted + ?, updatedAt = ? WHERE id = 1").run(
      bundle.quotaCost,
      now()
    );

    ensureTokenDistribution(
      db,
      address,
      bundle.id,
      bundle.quotaCost,
      sourceId,
      distributionStatus
    );

    return bundle;
  });

  const committedBundle = tx();

  return {
    bundleId: committedBundle.id,
    quotaCost: committedBundle.quotaCost,
    ...getSnapshot(address),
  };
}

export function confirmMintPayment(
  addressInput: string,
  bundleId: MintBundleId,
  txHashInput: string,
  amountWei: string
): MintConfirmationResult {
  const address = ensureAddress(addressInput);
  const txHash = txHashInput.trim().toLowerCase();
  const bundle = MINT_BUNDLES.find((item) => item.id === bundleId);

  if (!bundle) {
    throw new Error("Mint bundle was not found.");
  }

  const db = getDb();
  const tx = db.transaction(() => {
    const existing = db
      .prepare(
        "SELECT address, bundleId FROM mint_payments WHERE txHash = ?"
      )
      .get(txHash) as
      | {
          address: string;
          bundleId: MintBundleId;
        }
      | undefined;

    if (existing) {
      if (existing.address !== address || existing.bundleId !== bundle.id) {
        throw new Error("This payment hash is already linked to another mint.");
      }

      ensureTokenDistribution(db, address, bundle.id, bundle.quotaCost, txHash);

      return {
        bundle,
        alreadyRecorded: true,
      };
    }

    const state = mapAddressState(address);
    const globalLedger = getGlobalLedger();
    const remainingQuota = calculateRemainingQuota(state);

    if (remainingQuota < bundle.quotaCost) {
      throw new Error(
        `You need ${bundle.quotaCost} quota for this bundle. Finish more tasks or choose a smaller mint option.`
      );
    }

    if (globalLedger.minted + bundle.quotaCost > 4000) {
      throw new Error("The global mint cap is almost full, so this bundle is no longer available.");
    }

    const timestamp = now();

    db.prepare(
      `
        INSERT INTO mint_payments (txHash, address, bundleId, quotaCost, amountWei, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `
    ).run(txHash, address, bundle.id, bundle.quotaCost, amountWei, timestamp);

    db.prepare(
      "UPDATE address_states SET mintedUsed = mintedUsed + ?, updatedAt = ? WHERE address = ?"
    ).run(bundle.quotaCost, timestamp, address);

    db.prepare("UPDATE global_state SET minted = minted + ?, updatedAt = ? WHERE id = 1").run(
      bundle.quotaCost,
      timestamp
    );

    ensureTokenDistribution(db, address, bundle.id, bundle.quotaCost, txHash);

    return {
      bundle,
      alreadyRecorded: false,
    };
  });

  const committedBundle = tx();

  return {
    bundleId: committedBundle.bundle.id,
    quotaCost: committedBundle.bundle.quotaCost,
    alreadyRecorded: committedBundle.alreadyRecorded,
    ...getSnapshot(address),
  };
}
