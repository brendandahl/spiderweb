/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "NodeParent.h"
#include "nsIFile.h"
#include "nsDirectoryService.h"
#include "nsDirectoryServiceDefs.h"
#include "nsString.h"
#include "nsINodeLoader.h"

#if EXPOSE_INTL_API
#include "unicode/putil.h"
#endif

namespace mozilla {
namespace node {

using namespace mozilla::ipc;

NodeParent::NodeParent(const nsACString& script, nsINodeObserver* observer)
  : mProcess(nullptr),
    mNodeObserver(observer),
    mScript(script)
{
  MOZ_COUNT_CTOR(NodeParent);
}

MOZ_IMPLICIT NodeParent::~NodeParent()
{
  MOZ_COUNT_DTOR(NodeParent);
  MOZ_ASSERT(!mProcess);
}

void
NodeParent::Init()
{
}

nsresult
NodeParent::LaunchProcess()
{
  MOZ_ASSERT(!mProcess);

  mProcess = new NodeProcessParent();

  if (!mProcess->Launch(30 * 1000)) {
    mProcess->Delete();
    mProcess = nullptr;
    return NS_ERROR_FAILURE;
  }

  if (!Open(mProcess->GetChannel(),
            base::GetProcId(mProcess->GetChildProcessHandle()))) {
    mProcess->Delete();
    mProcess = nullptr;
    return NS_ERROR_FAILURE;
  }

  // Spidernode needs the path to the ICU data.
#if EXPOSE_INTL_API && defined(MOZ_ICU_DATA_ARCHIVE)
  nsAutoCString icuDataPath(u_getDataDirectory());
#else
  nsAutoCString icuDataPath("");
#endif

  // Build the path to the init script.
  nsCOMPtr<nsIFile> greDir;
  nsDirectoryService::gService->Get(NS_GRE_DIR,
                                    NS_GET_IID(nsIFile),
                                    getter_AddRefs(greDir));
  MOZ_ASSERT(greDir);
  greDir->AppendNative(NS_LITERAL_CSTRING("modules"));
  greDir->AppendNative(NS_LITERAL_CSTRING("spiderweb"));
  greDir->AppendNative(NS_LITERAL_CSTRING("init.js"));
  nsAutoString initScript;
  greDir->GetPath(initScript);

  nsTArray<nsCString> args;
  args.AppendElement(NS_LITERAL_CSTRING("node"));
  args.AppendElement(NS_LossyConvertUTF16toASCII(initScript));
  args.AppendElement(mScript);
  if (!SendStartNode(args, icuDataPath)) {
    return NS_ERROR_FAILURE;
  }

  return NS_OK;
}

void
NodeParent::DeleteProcess()
{
  // Close();

  // mProcess->Delete();
  // mProcess = nullptr;
}

mozilla::ipc::IPCResult
NodeParent::RecvMessage(const nsCString& aMessage)
{
  mNodeObserver->OnMessage(aMessage);
  return IPC_OK();
}

void
NodeParent::ActorDestroy(ActorDestroyReason aWhy)
{
}

} // namespace node
} // namespace mozilla
