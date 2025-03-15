# 📌 athc - XLSX to SQL Importer

## 📖 Description

`athc` est une commande permettant de lire un fichier `.xlsx` et d'insérer les données dans une base de données SQL (SQLite ou PostgreSQL), dans la table `people`.

---

## 🚀 Installation

Pour installer la commande, exécutez :

```sh
chmod +x install.sh
```

```sh
./install.sh
```

Pour désinstaller la commande, exécutez :

```sh
chmod +x uninstall.sh
```

```sh
./uninstall.sh
```

---

## ⚠️ Mise en garde

Si la commande est utilisée à partir d'une installation, il est **obligatoire** d'indiquer l'option `--location` (ou `-l`) pour spécifier la localisation du fichier SQLite.

---

## 🚀 Usage

```sh
node ace athc [options]
```

### 🔧 Options disponibles

| Option                          | Description                                                         |
| ------------------------------- | ------------------------------------------------------------------- |
| `-f, --file [FILE]`             | Chemin absolu ou relatif du fichier `.xlsx` à traiter.              |
| `-b, --batch [BATCH]`           | Nombre de lignes insérées par requête SQL (défaut : `100`).         |
| `-t, --thread [THREAD]`         | Nombre de threads utilisés (défaut : `11`).                         |
| `-c, --concurrent [CONCURRENT]` | Nombre de tâches concurrentes (défaut : `4`).                       |
| `-h, --host [HOST]`             | Hôte du serveur PostgreSQL.                                         |
| `-p, --port [PORT]`             | Port du serveur PostgreSQL.                                         |
| `-u, --user [USER]`             | Utilisateur du serveur PostgreSQL.                                  |
| `-w, --password [PASSWORD]`     | Mot de passe du serveur PostgreSQL.                                 |
| `-d, --database [DATABASE]`     | Nom de la base de données PostgreSQL.                               |
| `-l, --location [LOCATION]`     | Chemin du fichier SQLite.                                           |
| `-v, --verbose`                 | Mode verbeux pour afficher les actions en cours (défaut : `false`). |
| `--help`                        | Affiche l'aide et les options disponibles.                          |

---

## 💡 Exemples d'utilisation

### 📂 Lecture depuis stdin

```sh
cat ./people_sample.xlsx | node ace athc
```

```sh
node ace athc < ./people_sample.xlsx
```

### 📄 Spécifier un fichier directement

```sh
node ace athc --file ./people_sample.xlsx
```

```sh
node ace athc -f ./people_sample.xlsx
```

### 📍 Spécifier un fichier SQLite

```sh
node ace athc --location ./db.sqlite3 < ./people_sample.xlsx
```

```sh
node ace athc -l ./db.sqlite3 < ./people_sample.xlsx
```

### 📢 Mode verbeux

```sh
node ace athc --verbose < ./people_sample.xlsx
```

```sh
node ace athc -v < ./people_sample.xlsx
```

### 📜 Afficher l'aide

```sh
node ace athc --help
```

### 🛢️ Utilisation avec PostgreSQL

```sh
node ace athc --host 127.0.0.1 --port 5432 --database myDB --user johndoe --password myPassword < ./people_sample.xlsx
```

```sh
node ace athc -h 127.0.0.1 -p 5432 -d myDB -u johndoe -w myPassword < ./people_sample.xlsx
```

### 🚀 Optimisation des performances

- **Changer la taille des lots d'insertion** (par défaut : `100`)

```sh
node ace athc --batch 500 < ./people_sample.xlsx
```

```sh
node ace athc -b 500 < ./people_sample.xlsx
```

- **Ajuster le nombre de threads** (par défaut : `11`)

```sh
node ace athc --thread 12 < ./people_sample.xlsx
```

```sh
node ace athc -t 12 < ./people_sample.xlsx
```

- **Configurer les tâches concurrentes** (par défaut : `4`)

```sh
node ace athc --concurrent 8 < ./people_sample.xlsx
```

```sh
node ace athc -c 8 < ./people_sample.xlsx
```

---

## 🛠️ Configuration par défaut

Si aucune option n'est spécifiée, les données sont stockées dans une base de données SQLite interne au programme.

---

## 📌 Remarque

- L'utilisation de PostgreSQL nécessite de spécifier l'hôte, le port, l'utilisateur, le mot de passe et le nom de la base de données.
- Le mode verbeux est utile pour le débogage et le suivi des opérations en cours.
- Pour améliorer les performances, ajustez les options `--batch`, `--thread` et `--concurrent` en fonction de votre environnement.

---

🎯 **Profitez de `athc` pour automatiser vos imports de fichiers `.xlsx` vers une base de données SQL de manière rapide et efficace !** 🚀
