#!/bin/bash

# Fonction pour vérifier la version de Node.js
check_node_version() {
  REQUIRED_VERSION="v20.10.0"
  CURRENT_VERSION=$(node -v)

  if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$CURRENT_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo "La version de Node.js actuelle ($CURRENT_VERSION) est inférieure à la version requise ($REQUIRED_VERSION). Mise à jour en cours..."
    sudo apt install -y nodejs
  else
    echo "La version de Node.js ($CURRENT_VERSION) est suffisante."
  fi
}

# Met à jour le système et installe les dépendances nécessaires
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nodejs npm


# Vérifie la version de Node.js
check_node_version

# Définition des chemins
INSTALL_DIR="/opt/athc"
COMMAND_PATH="/usr/local/bin/athc"

# Supprime l'ancienne installation si elle existe
sudo rm -rf $INSTALL_DIR
sudo rm -f $COMMAND_PATH

# Clone le projet et entre dans le dossier
git clone https://github.com/evrardamoussouga/asin-take-home-challenge.git /tmp/asin-take-home-challenge
cd /tmp/asin-take-home-challenge

# Installe les dépendances du projet
npm install
npm run build

# Déplace les fichiers nécessaires dans /opt/
sudo mv /tmp/asin-take-home-challenge $INSTALL_DIR
sudo cp $INSTALL_DIR/start/worker.js $INSTALL_DIR/build/start/worker.js

# Crée un script global pour exécuter la commande
echo "#!/bin/bash" | sudo tee $COMMAND_PATH > /dev/null
echo "node $INSTALL_DIR/build/ace athc \"\$@\"" | sudo tee -a $COMMAND_PATH > /dev/null
sudo chmod +x $COMMAND_PATH

# Nettoie le dossier temporaire
rm -rf /tmp/asin-take-home-challenge

echo "Installation terminée ! Vous pouvez maintenant exécuter la commande : athc [options]"
