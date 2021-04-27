#-------------------------------------------------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License. See https://go.microsoft.com/fwlink/?linkid=2090316 for license information.
#-------------------------------------------------------------------------------------------------------------
FROM kuojianlu/codespaces-0126:latest

USER root

# TODO: will install the libsecret-1 in the docker image
RUN sudo apt-get update
RUN sudo apt-get -yq install libsecret-1-dev

RUN export PATH=$PATH:/home/codespaces/.npm-global/bin