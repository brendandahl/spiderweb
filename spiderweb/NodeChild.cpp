  /* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "NodeChild.h"
#include "NodeProcessChild.h"
#include "mozilla/ipc/ProcessChild.h"
#include "app/NodeBindings.h"

#include "mozilla/XPCOM.h"
#include "nsDirectoryService.h"
// #if EXPOSE_INTL_API
#include "unicode/putil.h"
// #endif

// Force all builtin modules to be referenced so they can actually run their
// DSO constructors, see http://git.io/DRIqCg.
#define REFERENCE_MODULE(name) \
  extern "C" void _register_ ## name(void); \
  void (*fp_register_ ## name)(void) = _register_ ## name
// Node's builtin modules:
REFERENCE_MODULE(async_wrap);
REFERENCE_MODULE(cares_wrap);
REFERENCE_MODULE(fs_event_wrap);
REFERENCE_MODULE(js_stream);
REFERENCE_MODULE(buffer);
REFERENCE_MODULE(config);
REFERENCE_MODULE(contextify);
REFERENCE_MODULE(crypto);
REFERENCE_MODULE(fs);
REFERENCE_MODULE(http_parser);
REFERENCE_MODULE(icu);
REFERENCE_MODULE(os);
REFERENCE_MODULE(util);
REFERENCE_MODULE(v8);
REFERENCE_MODULE(zlib);
REFERENCE_MODULE(pipe_wrap);
REFERENCE_MODULE(process_wrap);
REFERENCE_MODULE(signal_wrap);
REFERENCE_MODULE(spawn_sync);
REFERENCE_MODULE(stream_wrap);
REFERENCE_MODULE(tcp_wrap);
REFERENCE_MODULE(timer_wrap);
REFERENCE_MODULE(tls_wrap);
REFERENCE_MODULE(tty_wrap);
REFERENCE_MODULE(udp_wrap);
REFERENCE_MODULE(uv);
#undef REFERENCE_MODULE


using namespace mozilla::ipc;

namespace mozilla {
namespace node {

MOZ_IMPLICIT NodeChild::NodeChild()
{
  MOZ_COUNT_CTOR(NodeChild);
}

MOZ_IMPLICIT NodeChild::~NodeChild()
{
  MOZ_COUNT_DTOR(NodeChild);
}

bool
NodeChild::Init(base::ProcessId aParentPid,
                MessageLoop* aIOLoop,
                IPC::Channel* aChannel,
                nsAutoCString aNativeGREPath)
{
  if (NS_WARN_IF(!Open(aChannel, aParentPid, aIOLoop))) {
    return false;
  }
  // nsDirectoryService::RealInit();
// #if EXPOSE_INTL_API && defined(MOZ_ICU_DATA_ARCHIVE)
  // nsCOMPtr<nsIFile> greDir;
  // nsDirectoryService::gService->Get(NS_GRE_DIR,
  //                                   NS_GET_IID(nsIFile),
  //                                   getter_AddRefs(greDir));
  // MOZ_ASSERT(greDir);
  // nsAutoCString nativeGREPath;
  // greDir->GetNativePath(nativeGREPath);
  u_setDataDirectory("/Users/bdahl/projects/spiderweb/obj.debug.noindex/dist/NightlyDebug.app/Contents/Resources");
// #endif
  NodeBindings* nb = NodeBindings::Create();
  nb->Initialize();

  return SendPing();
}

bool
NodeChild::RecvPong()
{
  printf("Pong!\n");
  return true;
}

} // namespace node
} // namespace mozilla
