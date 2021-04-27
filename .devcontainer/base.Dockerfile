#-------------------------------------------------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License. See https://go.microsoft.com/fwlink/?linkid=2090316 for license information.
#-------------------------------------------------------------------------------------------------------------
FROM mcr.microsoft.com/oryx/build:vso-focal-20201204.1 as kitchensink

ARG USERNAME=codespaces
ARG USER_UID=1000
ARG USER_GID=$USER_UID

ARG NODE_VERSION=14

# Default to bash shell (other shells available at /usr/bin/fish and /usr/bin/zsh)
ENV SHELL=/bin/bash \
    ORYX_ENV_TYPE=vsonline-present \
    DOTNET_ROOT="/home/${USERNAME}/.dotnet" \ 
    NVM_SYMLINK_CURRENT=true \
    NVM_DIR="/home/${USERNAME}/.nvm" \
    NVS_HOME="/home/${USERNAME}/.nvs" \
    NPM_GLOBAL="/home/${USERNAME}/.npm-global"
ENV PATH="${ORIGINAL_PATH}:${NVM_DIR}/current/bin:${NPM_GLOBAL}:${DOTNET_ROOT}:${DOTNET_ROOT}/tools:/opt/conda/condabin:${ORYX_PATHS}"

# Install needed utilities and setup non-root user
COPY scripts/library-scripts/* scripts/setup-user.sh /tmp/scripts/
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    # Restore man command
    && yes | unminimize 2>&1 \
    # Run common script and setup user
    && bash /tmp/scripts/common-debian.sh "true" "${USERNAME}" "${USER_UID}" "${USER_GID}" "false" "true" \
    && bash /tmp/scripts/setup-user.sh "${USERNAME}" "${PATH}" \
    # Change owner of opt contents since Oryx can dynamically install and will run as ${USERNAME}
    && chown ${USERNAME} /opt/* \
    # Clean up
    && apt-get autoremove -y && apt-get clean -y

# Install and setup .NET Core
COPY scripts/symlinkDotNetCore.sh /home/${USERNAME}/symlinkDotNetCore.sh
RUN su ${USERNAME} -c 'bash /home/${USERNAME}/symlinkDotNetCore.sh ${USERNAME}' 2>&1 \
    && apt-get clean -y && rm -rf /home/${USERNAME}/symlinkDotNetCore.sh

# Setup Node.js, install NVM and NVS
RUN bash /tmp/scripts/node-debian.sh "${NVM_DIR}" ${NODE_VERSION} "${USERNAME}" \
    && (cd ${NVM_DIR} && git remote get-url origin && echo $(git log -n 1 --pretty=format:%H -- .)) > ${NVM_DIR}/.git-remote-and-commit \
    # Install nvs (alternate cross-platform Node.js version-management tool)
    && sudo -u ${USERNAME} git clone -c advice.detachedHead=false --depth 1 https://github.com/jasongin/nvs ${NVS_HOME} 2>&1 \
    && (cd ${NVS_HOME} && git remote get-url origin && echo $(git log -n 1 --pretty=format:%H -- .)) > ${NVS_HOME}/.git-remote-and-commit \
    && sudo -u ${USERNAME} bash ${NVS_HOME}/nvs.sh install \
    && rm ${NVS_HOME}/cache/* \
    # Set npm global location
    && sudo -u ${USERNAME} npm config set prefix ${NPM_GLOBAL} \
    && npm config -g set prefix ${NPM_GLOBAL} \
    # Clean up
    && rm -rf ${NVM_DIR}/.git ${NVS_HOME}/.git

# Install Azure functions core tools
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && echo "deb [arch=amd64] https://packages.microsoft.com/repos/microsoft-$(lsb_release -is | tr '[:upper:]' '[:lower:]')-$(lsb_release -cs)-prod $(lsb_release -cs) main" > /etc/apt/sources.list.d/dotnetdev.list \
    && curl -sL https://packages.microsoft.com/keys/microsoft.asc | (OUT=$(apt-key add - 2>&1) || echo $OUT) \
    && apt-get update \
    && apt-get install -y azure-functions-core-tools-3 \
    # Clean up
    && apt-get autoremove -y && apt-get clean -y && rm -rf /var/lib/apt/lists/*

CMD [ "sleep", "infinity" ]