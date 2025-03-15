#!/bin/bash

# Définition des chemins
INSTALL_DIR="/opt/athc"
COMMAND_PATH="/usr/local/bin/athc"

# Vérifie si le dossier d'installation existe
if [ -d "$INSTALL_DIR" ]; then
    echo "Suppression du dossier $INSTALL_DIR..."
    sudo rm -rf "$INSTALL_DIR"
else
    echo "Le dossier $INSTALL_DIR n'existe pas."
fi

# Vérifie si la commande globale existe
if [ -f "$COMMAND_PATH" ]; then
    echo "Suppression de la commande $COMMAND_PATH..."
    sudo rm -f "$COMMAND_PATH"
else
    echo "La commande athc n'existe pas dans /usr/local/bin."
fi

echo "Désinstallation terminée !"
