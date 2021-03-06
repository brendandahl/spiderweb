FROM          centos:6
MAINTAINER    Dustin J. Mitchell <dustin@mozilla.com>

### add worker user and setup its workspace
RUN useradd -d /home/worker -s /bin/bash -m worker
# Declare default working folder
WORKDIR       /home/worker

# This will create a host mounted filesystem when the cache is stripped
# on Try. This cancels out some of the performance losses of aufs. See
# bug 1291940.
VOLUME /home/worker/workspace
VOLUME /home/worker/tooltool-cache
VOLUME /home/worker/hg-shared

# install non-build specific dependencies in a single layer
ADD           system-setup.sh   /tmp/system-setup.sh
RUN           bash /tmp/system-setup.sh

# Builds need the share module enabled
ADD           hgrc /home/worker/.hgrc
RUN chown -R worker:worker /home/worker/.hgrc

# Set variable normally configured at login, by the shells parent process, these
# are taken from GNU su manual
ENV           HOME          /home/worker
ENV           SHELL         /bin/bash
ENV           USER          worker
ENV           LOGNAME       worker
ENV           HOSTNAME      taskcluster-worker

# Set a default command useful for debugging
CMD ["/bin/bash", "--login"]
